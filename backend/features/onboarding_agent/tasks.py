"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from . import selectors, services
from .agent import AgentError, build_guide

logger = logging.getLogger(__name__)


@shared_task(soft_time_limit=300, time_limit=330)
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
    except SoftTimeLimitExceeded:
        # Sans cela le guide resterait « en cours » indéfiniment.
        services.store_result(guide_id=guide_id, error="Analyse trop longue, réessayez plus tard.")
        return
    services.store_result(guide_id=guide_id, content=content, commit_sha=sha)
