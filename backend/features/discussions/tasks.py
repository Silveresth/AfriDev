"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from integrations import llm

from . import selectors, services
from .summarizer import summarize

logger = logging.getLogger(__name__)


@shared_task
def ai_summarize_thread(post_id: str) -> None:
    comments, total = selectors.thread_text(post_id=post_id)
    if not comments:
        return
    try:
        points = summarize(comments)
    except llm.LLMError:
        logger.warning("Résumé IA indisponible pour le fil %s", post_id)
        return
    if points:
        services.store_summary(post_id=post_id, points=points, comment_count=total)
