"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, QuerySet

from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors

from . import recommender
from .models import ProjectApplication

# Nombre de projets / profils examinés au plus (les plus récents).
SCAN_LIMIT = 500


def recommend_projects(*, user_id, limit: int = 10) -> list[tuple]:
    """[(projet, Match)] adaptés à la stack de l'utilisateur, hors ses propres projets."""
    stack = profile_selectors.get_stack(user_id=user_id)
    if not stack:
        return []
    applied = set(
        ProjectApplication.objects.alive()
        .filter(candidate_id=user_id)
        .values_list("project_id", flat=True)
    )
    projects = project_selectors.list_recruiting_projects().exclude(owner_id=user_id)
    ranked = []
    for project in projects.order_by("-created_at")[:SCAN_LIMIT]:
        if project.id in applied:
            continue
        match = recommender.score(stack, project.tags)
        if match.score > 0:
            ranked.append((project, match))
    ranked.sort(key=lambda pair: (pair[1].score, pair[0].stars), reverse=True)
    return ranked[:limit]


def recommend_candidates(*, project, limit: int = 10) -> list[tuple]:
    """[(profil, Match)] dont la stack couvre celle du projet."""
    ranked = []
    profiles = profile_selectors.list_profiles_with_stack().exclude(user_id=project.owner_id)
    for profile in profiles.order_by("-updated_at")[:SCAN_LIMIT]:
        match = recommender.score(profile.stack, project.tags, open_to_work=profile.open_to_work)
        if match.score > 0:
            ranked.append((profile, match))
    ranked.sort(key=lambda pair: pair[1].score, reverse=True)
    return ranked[:limit]


def get_application(*, application_id) -> ProjectApplication | None:
    return ProjectApplication.objects.alive().filter(id=application_id).first()


def list_applications_for_project(*, project_id) -> QuerySet[ProjectApplication]:
    return ProjectApplication.objects.alive().filter(project_id=project_id)


def list_my_applications(*, user) -> QuerySet[ProjectApplication]:
    return ProjectApplication.objects.alive().filter(candidate=user)


GOOD_FIRST_HINTS = ("good first", "good-first", "beginner", "easy", "débutant", "starter")
WELCOME_ISSUES = 6


def _label_names(labels) -> list[str]:
    return [
        str(label.get("name", "")) if isinstance(label, dict) else str(label)
        for label in labels or []
    ]


def welcome_issues(*, project_id) -> list[dict]:
    """Issues ouvertes du projet, les « good first issue » en tête."""
    rows = []
    issues = project_selectors.list_open_issues(project_id=project_id).order_by("-created_at")
    for issue in issues[:50]:
        labels = _label_names(issue.labels)
        good_first = any(hint in name.lower() for name in labels for hint in GOOD_FIRST_HINTS)
        rows.append(
            {
                "number": issue.number,
                "title": issue.title,
                "url": issue.url,
                "labels": labels[:4],
                "good_first": good_first,
            }
        )
    rows.sort(key=lambda row: not row["good_first"])
    return rows[:WELCOME_ISSUES]


def accepted_member_ids(*, project_id) -> list:
    return list(
        ProjectApplication.objects.alive()
        .filter(project_id=project_id, status=ProjectApplication.Status.ACCEPTED)
        .order_by("updated_at")
        .values_list("candidate_id", flat=True)
    )


def application_stats(*, since) -> dict:
    applications = ProjectApplication.objects.alive()
    by_status = dict(applications.values_list("status").annotate(n=Count("id")).order_by())
    return {"new": applications.filter(created_at__gte=since).count(), "by_status": by_status}
