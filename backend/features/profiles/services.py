"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from urllib.parse import urlsplit

from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.db.models.functions import Greatest

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from core.utils import normalize_tags

from .events import profile_updated, user_followed
from .models import SOCIAL_NETWORKS, WORK_PREFERENCES, Profile, SkillEndorsement, UserFollow

EDITABLE_FIELDS = {
    "banner_url",
    "social_links",
    "accent_color",
    "work_preferences",
    "daily_rate",
    "availability_note",
    "display_name",
    "bio",
    "avatar_url",
    "stack",
    "github_username",
    "location",
    "website",
    "open_to_work",
}


def create_profile(
    *, user_id, username: str, display_name: str = "", avatar_url: str = "", github_username=""
) -> Profile:
    profile, _ = Profile.objects.get_or_create(
        user_id=user_id,
        defaults={
            "id": user_id,
            "username": username,
            "display_name": display_name[:80],
            "avatar_url": avatar_url,
            "github_username": github_username,
        },
    )
    return profile


@transaction.atomic
def update_profile(*, profile: Profile, **fields) -> Profile:
    changed = []
    for name, value in fields.items():
        if name not in EDITABLE_FIELDS:
            continue
        if name == "stack":
            value = normalize_tags(value, limit=20)
        elif name == "work_preferences":
            value = [code for code in dict.fromkeys(value or []) if code in WORK_PREFERENCES]
        elif name == "social_links":
            value = clean_social_links(value)
        elif isinstance(value, str):
            value = value.strip()
        if getattr(profile, name) != value:
            setattr(profile, name, value)
            changed.append(name)
    if changed:
        profile.save(update_fields=[*changed, "updated_at"])
        transaction.on_commit(lambda: profile_updated.send(sender=Profile, user_id=profile.user_id))
    return profile


def clean_social_links(links: dict | None) -> dict:
    """Garde les réseaux connus, en https, sur le bon domaine ; une valeur vide retire le lien."""
    cleaned = {}
    for network, url in (links or {}).items():
        if network not in SOCIAL_NETWORKS:
            raise DomainError(f"Réseau inconnu : {network}.", code="invalid_social_link")
        url = (url or "").strip()
        if not url:
            continue
        parts = urlsplit(url)
        host = (parts.hostname or "").lower().removeprefix("www.").removeprefix("m.")
        domains = SOCIAL_NETWORKS[network]
        valid_host = not domains or any(host == d or host.endswith(f".{d}") for d in domains)
        if parts.scheme != "https" or not host or not valid_host:
            raise DomainError(
                f"Lien {network} invalide : une adresse https://{domains[0] if domains else '…'}"
                " est attendue.",
                code="invalid_social_link",
                details={"network": network},
            )
        cleaned[network] = url[:200]
    return cleaned


def apply_offline_update(*, user, profile_id, data: dict) -> None:
    """Écriture reçue de la copie locale (features/sync) : seul son propre profil."""
    profile = Profile.objects.filter(id=profile_id).first()
    if profile is None or profile.user_id != user.id:
        raise PermissionDeniedError("Vous ne pouvez modifier que votre propre profil.")
    update_profile(profile=profile, **data)


@transaction.atomic
def request_ai_bio(*, profile: Profile) -> Profile:
    from .tasks import ai_generate_bio

    profile.ai_bio_status = Profile.AiStatus.PENDING
    profile.save(update_fields=["ai_bio_status", "updated_at"])
    transaction.on_commit(lambda: ai_generate_bio.delay(str(profile.id)))
    return profile


def store_ai_bio(*, profile_id, suggestion: str | None) -> None:
    status = Profile.AiStatus.READY if suggestion else Profile.AiStatus.FAILED
    Profile.objects.filter(id=profile_id).update(
        ai_bio_suggestion=suggestion or "", ai_bio_status=status
    )


def recompute_reputation(*, user_id) -> Profile | None:
    """Recalcule le Craft Score (deux jauges), le détail et les badges (idempotent)."""
    from . import reputation

    profile = Profile.objects.filter(user_id=user_id).first()
    if profile is None:
        return None
    user_id = profile.user_id  # UUID : la tâche Celery le reçoit en texte
    details = reputation.craft_details(user_id=user_id)
    entraide = reputation.help_score(details)
    creation = reputation.creation_score(details)
    score = reputation.craft_score(entraide=entraide, creation=creation)
    # Jauge enregistrée avant le calcul des badges : le classement Top 5 % la lit en base.
    if profile.craft_help != entraide:
        Profile.objects.filter(pk=profile.pk).update(craft_help=entraide)
        profile.craft_help = entraide
    badges = reputation.merge_awards(
        profile.badges,
        reputation.compute_badges(user_id=user_id, details=details, entraide=entraide, score=score),
    )
    new = {
        "karma_score": score,
        "craft_creation": creation,
        "karma_details": details,
        "badges": badges,
    }
    changed = [name for name, value in new.items() if getattr(profile, name) != value]
    if changed:
        for name in changed:
            setattr(profile, name, new[name])
        profile.save(update_fields=[*changed, "updated_at"])
    return profile


# ── Profil pro : épinglés, endossements ──

MAX_PINNED = 3
PINNABLE = ("post", "question", "snippet", "project")


def pinned_summaries(items: list[dict], *, viewer_id=None) -> dict:
    """{(type, id): résumé} des contenus épinglés encore visibles."""
    from features.feed import selectors as feed_selectors
    from features.projects import selectors as project_selectors
    from features.qa import selectors as qa_selectors
    from features.snippets import selectors as snippet_selectors

    ids = {kind: [i["target_id"] for i in items if i["target_type"] == kind] for kind in PINNABLE}
    found = {
        "post": feed_selectors.post_summaries(post_ids=ids["post"]),
        "question": qa_selectors.question_summaries(question_ids=ids["question"]),
        "snippet": snippet_selectors.snippet_summaries(
            snippet_ids=ids["snippet"], viewer_id=viewer_id
        ),
        "project": project_selectors.project_summaries(project_ids=ids["project"]),
    }
    return {
        (kind, str(target_id)): summary
        for kind, rows in found.items()
        for target_id, summary in rows.items()
    }


def set_pinned(*, profile: Profile, items: list[dict]) -> Profile:
    """Remplace les épinglés (ordre conservé) ; seulement ses propres contenus publics."""
    cleaned, seen = [], set()
    for item in items or []:
        kind, target_id = item.get("target_type"), str(item.get("target_id") or "")
        if kind not in PINNABLE or not target_id or (kind, target_id) in seen:
            continue
        seen.add((kind, target_id))
        cleaned.append({"target_type": kind, "target_id": target_id})
    if len(cleaned) > MAX_PINNED:
        raise DomainError(f"Au plus {MAX_PINNED} contenus épinglés.", code="too_many_pinned")
    summaries = pinned_summaries(cleaned)  # sans viewer : un snippet privé est refusé
    for item in cleaned:
        summary = summaries.get((item["target_type"], item["target_id"]))
        if summary is None or summary["author_id"] != profile.user_id:
            raise DomainError(
                "Vous ne pouvez épingler que vos propres contenus publics.", code="invalid_pin"
            )
    profile.pinned = cleaned
    profile.save(update_fields=["pinned", "updated_at"])
    return profile


def _endorsable(endorsee: Profile, endorser, skill: str) -> str:
    if endorsee.user_id == endorser.id:
        raise DomainError("On ne s'endosse pas soi-même.", code="self_endorsement")
    skill = (skill or "").strip().lower()
    if skill not in endorsee.stack:
        raise NotFoundError("Cette compétence ne figure pas dans sa stack.", code="unknown_skill")
    return skill


def endorse(*, endorsee: Profile, endorser, skill: str) -> SkillEndorsement:
    """Idempotent : endosser deux fois la même compétence ne change rien."""
    skill = _endorsable(endorsee, endorser, skill)
    endorsement, _ = SkillEndorsement.objects.get_or_create(
        endorsee_id=endorsee.user_id, endorser=endorser, skill=skill
    )
    return endorsement


def withdraw_endorsement(*, endorsee: Profile, endorser, skill: str) -> None:
    SkillEndorsement.objects.filter(
        endorsee_id=endorsee.user_id, endorser=endorser, skill=(skill or "").strip().lower()
    ).delete()


# ── Préférences d'accueil (onboarding) ──


@transaction.atomic
def save_preferences(
    *,
    profile: Profile,
    experience_level: str = "",
    goals=(),
    topics=(),
    stack=(),
    learning=(),
) -> Profile:
    """Enregistre le choix de l'écran d'accueil : stack (matchmaking), tags suivis et objectifs
    (fil personnalisé). Idempotent ; marque l'accueil comme terminé."""
    from django.utils import timezone

    from . import preferences

    if experience_level and experience_level not in preferences.EXPERIENCE_LEVELS:
        raise DomainError("Niveau d'expérience inconnu.", code="invalid_level")
    stack = preferences.clean_tags(stack, limit=20)
    profile.experience_level = experience_level
    profile.goals = [goal for goal in dict.fromkeys(goals or []) if goal in preferences.GOALS]
    profile.interests = preferences.build_interests(topics=topics, learning=learning, stack=stack)
    profile.stack = stack or profile.stack
    profile.onboarded_at = profile.onboarded_at or timezone.now()
    profile.save(
        update_fields=[
            "experience_level",
            "goals",
            "interests",
            "stack",
            "onboarded_at",
            "updated_at",
        ]
    )
    transaction.on_commit(lambda: profile_updated.send(sender=Profile, user_id=profile.user_id))
    return profile


def skip_onboarding(*, profile: Profile) -> Profile:
    """« Plus tard » : l'écran ne revient pas, les préférences restent modifiables."""
    from django.utils import timezone

    if profile.onboarded_at is None:
        profile.onboarded_at = timezone.now()
        profile.save(update_fields=["onboarded_at", "updated_at"])
    return profile


# ── Abonnements (followers) ──


def _shift_follow_counts(*, follower_id, followed_id, delta: int) -> None:
    """Met à jour les deux compteurs en base (F()), sans lecture préalable ni course."""
    Profile.objects.filter(user_id=followed_id).update(
        followers_count=Greatest(F("followers_count") + delta, 0)
    )
    Profile.objects.filter(user_id=follower_id).update(
        following_count=Greatest(F("following_count") + delta, 0)
    )


def follow(*, follower, followed: Profile) -> bool:
    """Idempotent. Renvoie True si l'abonnement vient d'être créé."""
    if followed.user_id == follower.id:
        raise DomainError("Vous ne pouvez pas vous suivre vous-même.", code="self_follow")
    try:
        with transaction.atomic():
            _, created = UserFollow.objects.get_or_create(
                follower_id=follower.id, followed_id=followed.user_id
            )
            if created:
                _shift_follow_counts(follower_id=follower.id, followed_id=followed.user_id, delta=1)
    except IntegrityError:  # double clic concurrent : l'autre requête a gagné
        return False
    if created:
        transaction.on_commit(
            lambda: user_followed.send(
                sender=UserFollow, follower_id=follower.id, followed_id=followed.user_id
            )
        )
    return created


@transaction.atomic
def unfollow(*, follower, followed: Profile) -> bool:
    """Idempotent. Renvoie True si un abonnement a été supprimé."""
    deleted, _ = UserFollow.objects.filter(
        follower_id=follower.id, followed_id=followed.user_id
    ).delete()
    if deleted:
        _shift_follow_counts(follower_id=follower.id, followed_id=followed.user_id, delta=-1)
    return bool(deleted)


@transaction.atomic
def forget_follows(*, user_id) -> None:
    """Avant la suppression d'un compte : ses abonnements disparaissent, et les compteurs des
    membres qu'il suivait (ou qui le suivaient) sont corrigés."""
    for follow in UserFollow.objects.filter(Q(follower_id=user_id) | Q(followed_id=user_id)):
        _shift_follow_counts(
            follower_id=follow.follower_id, followed_id=follow.followed_id, delta=-1
        )
    UserFollow.objects.filter(Q(follower_id=user_id) | Q(followed_id=user_id)).delete()


def recount_follows() -> int:
    """Resynchronise les compteurs depuis la table des abonnements (maintenance)."""
    from django.db.models import Count, OuterRef, Subquery
    from django.db.models.functions import Coalesce

    def _count(field: str):
        return Coalesce(
            Subquery(
                UserFollow.objects.filter(**{field: OuterRef("user_id")})
                .values(field)
                .annotate(total=Count("id"))
                .values("total")
            ),
            0,
        )

    return Profile.objects.update(
        followers_count=_count("followed_id"), following_count=_count("follower_id")
    )
