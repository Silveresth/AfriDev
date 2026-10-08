"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from integrations import llm

from . import selectors, services
from .translator import run

logger = logging.getLogger(__name__)


@shared_task
def ai_translate(translation_id: str) -> None:
    translation = selectors.get_translation(translation_id=translation_id)
    if translation is None:
        return
    try:
        result = run(translation)
    except llm.LLMError:
        logger.warning("Traduction IA impossible pour %s", translation_id)
        result = None
    services.store_result(translation_id=translation_id, result=result)
