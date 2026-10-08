"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from . import selectors, services
from .agent import AgentError, build_guide

logger = logging.getLogger(__name__)


@shared_task(soft_time_limit=300)
def ai_build_onboarding_guide(guide_id: str) -> None:
    guide = selectors.get_guide(guide_id=guide_id)
    if guide is None:
        return
    try:
        content, sha = build_guide(guide.repo_url)
    except AgentError as exc:
        logger.warning("Guide d'onboarding impossible pour %s : %s", guide.repo_url, exc)
        services.store_result(guide_id=guide_id, error=str(exc))
        return
    services.store_result(guide_id=guide_id, content=content, commit_sha=sha)
