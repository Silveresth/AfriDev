"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, Q, QuerySet

from .models import Issue, Project


def list_projects(
    *, tag: str | None = None, owner_id=None, recruiting: bool | None = None, query=None
) -> QuerySet[Project]:
    projects = Project.objects.alive()
    if tag:
        projects = projects.filter(tags__icontains=f'"{tag.lower()}"')
    if owner_id:
        projects = projects.filter(owner_id=owner_id)
    if recruiting is not None:
        projects = projects.filter(is_recruiting=recruiting)
    if query:
        projects = projects.filter(Q(name__icontains=query) | Q(description__icontains=query))
    return projects


def get_project(*, project_id) -> Project | None:
    return Project.objects.alive().filter(id=project_id).first()


def list_open_issues(*, project_id) -> QuerySet[Issue]:
    return Issue.objects.alive().filter(project_id=project_id, is_open=True)


def list_good_first_issues(*, tag: str | None = None) -> QuerySet[Issue]:
    issues = Issue.objects.alive().filter(is_open=True, project__deleted_at__isnull=True)
    if tag:
        issues = issues.filter(project__tags__icontains=f'"{tag.lower()}"')
    return issues.select_related("project").order_by("-created_at")


def list_recruiting_projects() -> QuerySet[Project]:
    return Project.objects.alive().filter(is_recruiting=True)


def open_issue_counts(*, project_ids) -> dict:
    rows = (
        Issue.objects.alive()
        .filter(project_id__in=project_ids, is_open=True)
        .values("project_id")
        .annotate(total=Count("id"))
    )
    return {row["project_id"]: row["total"] for row in rows}


def project_stats(*, since) -> dict:
    projects = Project.objects.alive()
    return {
        "total": projects.count(),
        "new": projects.filter(created_at__gte=since).count(),
        "recruiting": projects.filter(is_recruiting=True).count(),
        "sync_errors": projects.exclude(sync_error="").count(),
    }


def project_summaries(*, project_ids) -> dict:
    """{project_id: {title, excerpt, author_id, created_at, stars}} (épinglés du profil)."""
    return {
        p.id: {
            "title": p.name,
            "excerpt": p.description[:200],
            "author_id": p.owner_id,
            "created_at": p.created_at,
            "stars": p.stars,
        }
        for p in Project.objects.alive().filter(id__in=list(project_ids))
    }


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD)."""
    return {
        "projects": list(
            Project.objects.filter(owner_id=user_id).values(
                "id", "name", "description", "repo_url", "tags", "created_at", "deleted_at"
            )
        )
    }
