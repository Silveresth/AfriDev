"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import QuerySet

from .models import Profile


def get_profile_by_username(*, username: str) -> Profile | None:
    return Profile.objects.alive().filter(username__iexact=username).first()


def get_profile_for_user(*, user_id) -> Profile | None:
    return Profile.objects.alive().filter(user_id=user_id).first()


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
