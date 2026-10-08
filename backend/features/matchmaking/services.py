"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.db import transaction

from core.exceptions import ConflictError, DomainError, NotFoundError, PermissionDeniedError
from features.projects import selectors as project_selectors

from .events import application_answered, application_submitted
from .models import ProjectApplication


@transaction.atomic
def apply_to_project(*, candidate, project_id, message: str = "") -> ProjectApplication:
    project = project_selectors.get_project(project_id=project_id)
    if project is None:
        raise NotFoundError("Projet introuvable.")
    if project.owner_id == candidate.id:
        raise DomainError("Vous portez déjà ce projet.", code="own_project")
    if not project.is_recruiting:
        raise DomainError("Ce projet ne cherche pas de contributeurs.", code="not_recruiting")
    if (
        ProjectApplication.objects.alive()
        .filter(project_id=project_id, candidate=candidate)
        .exists()
    ):
        raise ConflictError("Vous avez déjà candidaté à ce projet.", code="already_applied")

    application = ProjectApplication.objects.create(
        project_id=project_id, candidate=candidate, message=message.strip()
    )
    transaction.on_commit(
        lambda: application_submitted.send(
            sender=ProjectApplication,
            application_id=application.id,
            project_id=project.id,
            project_name=project.name,
            project_owner_id=project.owner_id,
            candidate_id=candidate.id,
        )
    )
    return application


@transaction.atomic
def answer_application(*, application: ProjectApplication, user, accept: bool):
    project = project_selectors.get_project(project_id=application.project_id)
    if project is None or project.owner_id != user.id:
        raise PermissionDeniedError("Seul le porteur du projet peut répondre.")
    if application.status != ProjectApplication.Status.PENDING:
        raise ConflictError("Cette candidature a déjà reçu une réponse.", code="already_answered")

    application.status = (
        ProjectApplication.Status.ACCEPTED if accept else ProjectApplication.Status.DECLINED
    )
    application.save(update_fields=["status", "updated_at"])
    transaction.on_commit(
        lambda: application_answered.send(
            sender=ProjectApplication,
            application_id=application.id,
            project_id=project.id,
            project_name=project.name,
            candidate_id=application.candidate_id,
            accepted=accept,
        )
    )
    return application


def withdraw_application(*, application: ProjectApplication, user) -> None:
    if application.candidate_id != user.id:
        raise PermissionDeniedError("Ce n'est pas votre candidature.")
    application.soft_delete()
