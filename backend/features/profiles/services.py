"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.db import transaction

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from core.utils import normalize_tags

from .events import profile_updated
from .models import WORK_PREFERENCES, Profile, SkillEndorsement

EDITABLE_FIELDS = {
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
        elif isinstance(value, str):
            value = value.strip()
        if getattr(profile, name) != value:
            setattr(profile, name, value)
            changed.append(name)
    if changed:
        profile.save(update_fields=[*changed, "updated_at"])
        transaction.on_commit(lambda: profile_updated.send(sender=Profile, user_id=profile.user_id))
    return profile


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
    """Recalcule karma, détail et badges d'un membre à partir des données (idempotent)."""
    from . import reputation

    profile = Profile.objects.filter(user_id=user_id).first()
    if profile is None:
        return None
    user_id = profile.user_id  # UUID : la tâche Celery le reçoit en texte
    details = reputation.karma_details(user_id=user_id)
    karma = reputation.karma_score(details)
    badges = reputation.merge_awards(
        profile.badges, reputation.compute_badges(user_id=user_id, karma=karma)
    )
    if (profile.karma_score, profile.karma_details, profile.badges) != (karma, details, badges):
        profile.karma_score, profile.karma_details, profile.badges = karma, details, badges
        profile.save(update_fields=["karma_score", "karma_details", "badges", "updated_at"])
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
