"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.db import transaction
from django.utils import timezone

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from core.utils import normalize_tags
from integrations import github

from .events import project_deleted, project_saved
from .models import Issue, Project


def _validate_repo(repo_url: str) -> str:
    repo_url = (repo_url or "").strip()
    if repo_url:
        try:
            github.parse_repo_url(repo_url)
        except github.GitHubError as exc:
            raise DomainError(str(exc), code="invalid_repo") from exc
    return repo_url


def _after_save(project: Project, *, sync_repo: bool) -> None:
    from .tasks import sync_project_repo

    if sync_repo and project.repo_url:
        transaction.on_commit(lambda: sync_project_repo.delay(str(project.id)))
    transaction.on_commit(
        lambda: project_saved.send(sender=Project, project_id=project.id, owner_id=project.owner_id)
    )


@transaction.atomic
def create_project(
    *,
    owner,
    name: str,
    description: str = "",
    repo_url: str = "",
    tags: list | None = None,
    is_recruiting: bool = True,
    project_id=None,
) -> Project:
    if project_id:
        existing = Project.objects.filter(id=project_id).first()
        if existing:
            if existing.owner_id != owner.id:
                raise PermissionDeniedError("Identifiant déjà utilisé.")
            return existing
    if not name.strip():
        raise DomainError("Le projet a besoin d'un nom.", code="invalid_project")

    project = Project(
        owner=owner,
        name=name.strip(),
        description=description.strip(),
        repo_url=_validate_repo(repo_url),
        tags=normalize_tags(tags, limit=12),
        is_recruiting=is_recruiting,
    )
    if project_id:
        project.id = project_id
    project.save()
    _after_save(project, sync_repo=True)
    return project


@transaction.atomic
def update_project(*, project: Project, user, **fields) -> Project:
    if project.owner_id != user.id:
        raise PermissionDeniedError("Seul le porteur du projet peut le modifier.")
    changed = []
    for name in ("name", "description", "repo_url", "tags", "is_recruiting"):
        if name not in fields or fields[name] is None:
            continue
        value = fields[name]
        if name == "repo_url":
            value = _validate_repo(value)
        elif name == "tags":
            value = normalize_tags(value, limit=12)
        elif isinstance(value, str):
            value = value.strip()
        if getattr(project, name) != value:
            setattr(project, name, value)
            changed.append(name)
    if changed:
        project.save(update_fields=[*changed, "updated_at"])
        _after_save(project, sync_repo="repo_url" in changed)
    return project


@transaction.atomic
def delete_project(*, project: Project, user) -> None:
    if project.owner_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul le porteur du projet peut le supprimer.")
    project.soft_delete()
    transaction.on_commit(lambda: project_deleted.send(sender=Project, project_id=project.id))


@transaction.atomic
def request_repo_sync(*, project: Project, user) -> Project:
    if project.owner_id != user.id:
        raise PermissionDeniedError("Seul le porteur du projet peut le synchroniser.")
    if not project.repo_url:
        raise DomainError("Ce projet n'a pas de dépôt GitHub.", code="no_repo")
    from .tasks import sync_project_repo

    transaction.on_commit(lambda: sync_project_repo.delay(str(project.id)))
    return project


@transaction.atomic
def store_repo_sync(*, project_id, repo: dict | None, issues: list[dict], error: str = "") -> None:
    project = Project.objects.alive().select_for_update().filter(id=project_id).first()
    if project is None:
        return
    project.last_synced_at = timezone.now()
    project.sync_error = error[:300]
    if repo:
        project.stars = repo.get("stars", 0)
        project.language = (repo.get("language") or "")[:40]
        if not project.tags:
            topics = [repo.get("language"), *repo.get("topics", [])]
            project.tags = normalize_tags([t for t in topics if t], limit=12)
        if not project.description and repo.get("description"):
            project.description = repo["description"][:3000]
    project.save()

    if repo is None:
        return
    seen = set()
    for item in issues:
        seen.add(item["number"])
        Issue.objects.update_or_create(
            project=project,
            number=item["number"],
            defaults={
                "title": item["title"][:300],
                "url": item["url"],
                "labels": item.get("labels", []),
                "is_open": True,
                "deleted_at": None,
            },
        )
    # Issues fermées ou sans label « good first issue » depuis la dernière synchro.
    project.issues.filter(is_open=True).exclude(number__in=seen).update(is_open=False)


def apply_offline_write(*, user, op: str, record_id, data: dict) -> None:
    """Écriture rejouée depuis la copie locale (features/sync)."""
    if op == "PUT":
        create_project(
            owner=user,
            project_id=record_id,
            name=data.get("name") or "",
            description=data.get("description") or "",
            repo_url=data.get("repo_url") or "",
            tags=data.get("tags"),
        )
        return
    project = Project.objects.alive().filter(id=record_id).first()
    if project is None:
        raise NotFoundError("Projet introuvable.")
    if op == "PATCH":
        update_project(project=project, user=user, **data)
    elif op == "DELETE":
        delete_project(project=project, user=user)
