"""Candidature acceptée : le guide de démarrage du dépôt est préparé sans attendre la demande."""

import logging

from django.contrib.auth import get_user_model
from django.dispatch import receiver

from core.exceptions import DomainError
from features.matchmaking.events import application_answered
from features.projects import selectors as project_selectors

from . import services

logger = logging.getLogger(__name__)


@receiver(application_answered)
def on_application_answered(sender, project_id, candidate_id, accepted, **kwargs):
    if not accepted:
        return
    project = project_selectors.get_project(project_id=project_id)
    candidate = get_user_model().objects.filter(id=candidate_id).first()
    if project is None or candidate is None or not project.repo_url:
        return
    try:
        services.request_guide(user=candidate, repo_url=project.repo_url, project_id=project.id)
    except DomainError:
        logger.info("Guide non lancé pour le projet %s : dépôt invalide.", project_id)
