"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import QuerySet

from .models import Profile, UserFollow


def get_profile_by_username(*, username: str) -> Profile | None:
    return Profile.objects.alive().filter(username__iexact=username).first()


def get_profile_for_user(*, user_id) -> Profile | None:
    return Profile.objects.alive().filter(user_id=user_id).first()


def search_people(*, query: str, viewer_id=None, limit: int = 20) -> list[Profile]:
    """Comptes par pseudo ou nom (comme TikTok / X) : pseudo exact, puis début de pseudo ou de
    nom, puis contenu ; à égalité, les membres suivis par le visiteur et les plus suivis d'abord.
    Sert aussi l'autocomplétion des @mentions."""
    from django.db.models import Case, IntegerField, Q, Value, When

    query = (query or "").strip().lstrip("@")[:40]
    if not query:
        return []
    followed = following_user_ids(user_id=viewer_id) if viewer_id else []
    rows = (
        Profile.objects.alive()
        .filter(user__is_active=True)
        .filter(
            Q(username__icontains=query)
            | Q(display_name__icontains=query)
            | Q(github_username__iexact=query)
        )
        .annotate(
            rank=Case(
                When(username__iexact=query, then=Value(0)),
                When(username__istartswith=query, then=Value(1)),
                When(display_name__istartswith=query, then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            ),
            followed=Case(
                When(user_id__in=followed, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            ),
        )
        .order_by("rank", "followed", "-followers_count", "username")
    )
    return list(rows[: max(1, min(limit, 50))])


def new_followers_count(*, user_id, since) -> int:
    return UserFollow.objects.filter(followed_id=user_id, created_at__gte=since).count()


def team_candidates(*, tags, exclude_user_ids, limit: int = 25) -> list[Profile]:
    """Membres dont la stack recoupe les tags d'un projet : recoupement, disponibilité (« Open
    to Work »), puis réputation. Pool borné, tri en mémoire (une requête)."""
    wanted = {str(tag).lower() for tag in tags if tag}
    pool = (
        Profile.objects.alive()
        .filter(user__is_active=True)
        .exclude(user_id__in=list(exclude_user_ids))
        .exclude(stack=[])
        .order_by("-open_to_work", "-karma_score")[:400]
    )
    ranked = []
    for profile in pool:
        shared = [skill for skill in profile.stack if str(skill).lower() in wanted]
        if shared:
            ranked.append((len(shared), profile.open_to_work, profile.karma_score, profile))
    ranked.sort(key=lambda row: (row[0], row[1], row[2]), reverse=True)
    return [row[3] for row in ranked[:limit]]


def user_ids_for_usernames(*, usernames) -> dict:
    """{pseudo en minuscules: user_id} des comptes actifs (résolution des @mentions)."""
    names = [name.lower() for name in usernames if name]
    if not names:
        return {}
    from django.db.models.functions import Lower

    rows = (
        Profile.objects.alive()
        .filter(user__is_active=True)
        .annotate(lower=Lower("username"))
        .filter(lower__in=names)
        .values_list("lower", "user_id")
    )
    return dict(rows)


def get_profiles(*, user_ids) -> dict:
    """{user_id: profile} pour afficher les auteurs d'une liste."""
    profiles = Profile.objects.alive().filter(user_id__in=list(user_ids))
    return {profile.user_id: profile for profile in profiles}


def author_cards(*, user_ids) -> dict:
    """{user_id: {id, username, display_name, avatar_url, location, stack, karma, badges}}."""
    return {
        user_id: {
            "id": str(user_id),
            "username": profile.username,
            "display_name": profile.display_name or profile.username,
            "avatar_url": profile.avatar_url,
            "location": profile.location,
            "stack": list(profile.stack)[:3],
            "karma": profile.karma_score,
            "badges": [{"code": b["code"], "label": b["label"]} for b in profile.badges[:2]],
        }
        for user_id, profile in get_profiles(user_ids=set(user_ids)).items()
    }


def is_following(*, follower_id, followed_id) -> bool:
    if not follower_id or follower_id == followed_id:
        return False
    return UserFollow.objects.filter(follower_id=follower_id, followed_id=followed_id).exists()


def followed_ids(*, follower_id, user_ids) -> set:
    """Parmi `user_ids`, ceux que suit `follower_id` (une requête pour toute une liste)."""
    if not follower_id:
        return set()
    return set(
        UserFollow.objects.filter(
            follower_id=follower_id, followed_id__in=list(user_ids)
        ).values_list("followed_id", flat=True)
    )


def list_followers(*, user_id):
    """Abonnements reçus, plus récents d'abord (paginés par curseur sur created_at)."""
    return UserFollow.objects.filter(followed_id=user_id).only("id", "follower_id", "created_at")


def list_following(*, user_id):
    return UserFollow.objects.filter(follower_id=user_id).only("id", "followed_id", "created_at")


def following_user_ids(*, user_id) -> list:
    """Membres suivis : sert au fil « Abonnements » et aux recommandations."""
    return list(
        UserFollow.objects.filter(follower_id=user_id).values_list("followed_id", flat=True)
    )


SUGGESTION_POOL = 300


def suggested_people(*, user_id, tags, limit: int = 8) -> list[dict]:
    """Membres à suivre : stack proche des tags choisis, puis Craft Score.

    Pool borné (les plus réputés) puis score en mémoire : portable PostgreSQL / SQLite,
    et une seule requête quelle que soit la taille de la communauté.
    """
    wanted = {str(tag).lower() for tag in tags or []}
    already = set(following_user_ids(user_id=user_id)) | {user_id}
    pool = (
        Profile.objects.alive()
        .exclude(user_id__in=already)
        .only("user_id", "username", "display_name", "avatar_url", "stack", "karma_score")
        .order_by("-karma_score")[:SUGGESTION_POOL]
    )
    ranked = []
    for profile in pool:
        shared = [skill for skill in profile.stack if skill.lower() in wanted]
        if shared or not wanted:
            ranked.append((len(shared), profile.karma_score, profile, shared))
    ranked.sort(key=lambda row: (-row[0], -row[1]))
    return [
        {
            "id": str(profile.user_id),
            "username": profile.username,
            "display_name": profile.display_name or profile.username,
            "avatar_url": profile.avatar_url,
            "craft_score": profile.karma_score,
            "shared_stack": shared[:3],
        }
        for _, _, profile, shared in ranked[:limit]
    ]


def feed_preferences(*, user_id=None) -> dict:
    """Ce dont le fil « Pour vous » a besoin : {mix, interests, following}. Anonyme : défauts."""
    from . import preferences

    if not user_id:
        return {"mix": preferences.feed_mix(goals=[]), "interests": [], "following": []}
    row = (
        Profile.objects.filter(user_id=user_id)
        .values("goals", "experience_level", "interests", "stack")
        .first()
    ) or {}
    interests = list(dict.fromkeys([*(row.get("interests") or []), *(row.get("stack") or [])]))
    return {
        "mix": preferences.feed_mix(
            goals=row.get("goals") or [], level=row.get("experience_level") or ""
        ),
        "interests": interests,
        "following": following_user_ids(user_id=user_id),
    }


def github_stack(*, profile) -> list[str]:
    """Technologies déduites des langages GitHub du membre (cache 6 h) ; [] sinon."""
    from . import preferences

    overview = github_overview(profile=profile)
    return preferences.github_languages_to_tags(overview["top_languages"]) if overview else []


def list_profiles_with_stack() -> QuerySet[Profile]:
    """Candidats potentiels pour le matchmaking."""
    return Profile.objects.alive().exclude(stack=[])


def get_stack(*, user_id) -> list[str]:
    profile = get_profile_for_user(user_id=user_id)
    return list(profile.stack) if profile else []


def endorsements(*, profile, viewer=None, sample: int = 3) -> list[dict]:
    """[{skill, count, endorser_ids (les premiers), endorsed_by_me}] pour chaque compétence."""
    from .models import SkillEndorsement

    rows = SkillEndorsement.objects.filter(endorsee_id=profile.user_id).order_by("created_at")
    by_skill: dict[str, list] = {}
    for skill, endorser_id in rows.values_list("skill", "endorser_id"):
        by_skill.setdefault(skill, []).append(endorser_id)
    viewer_id = viewer.id if viewer and viewer.is_authenticated else None
    skills = list(profile.stack) + [s for s in by_skill if s not in profile.stack]
    result = [
        {
            "skill": skill,
            "count": len(by_skill.get(skill, [])),
            "endorser_ids": by_skill.get(skill, [])[:sample],
            "endorsed_by_me": viewer_id in by_skill.get(skill, []),
        }
        for skill in skills
        if skill in profile.stack or by_skill.get(skill)
    ]
    return sorted(result, key=lambda row: -row["count"])


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD) : profil et endossements."""
    from .models import SkillEndorsement

    profile = Profile.objects.filter(user_id=user_id).values().first()
    return {
        "profile": profile,
        "following": list(
            UserFollow.objects.filter(follower_id=user_id).values(
                "followed__username", "created_at"
            )
        ),
        "endorsements_received": list(
            SkillEndorsement.objects.filter(endorsee_id=user_id).values(
                "skill", "endorser__username", "created_at"
            )
        ),
        "endorsements_given": list(
            SkillEndorsement.objects.filter(endorser_id=user_id).values(
                "skill", "endorsee__username", "created_at"
            )
        ),
    }


def github_overview(*, profile) -> dict | None:
    """Section GitHub du profil, mise en cache 6 h ; None sans compte GitHub ou si injoignable."""
    from django.core.cache import cache

    from integrations import github

    username = profile.github_username
    if not username:
        return None
    key = f"profiles:github:{username.lower()}"
    cached = cache.get(key)
    if cached is not None:
        return cached or None
    try:
        overview = github.get_user_overview(username)
    except github.GitHubError:
        return None  # pas mis en cache : on réessaiera
    cache.set(key, overview or {}, 6 * 3600)
    return overview
