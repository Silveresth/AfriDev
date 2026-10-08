"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from integrations import llm

from . import selectors, services
from .ai_moderator import review

logger = logging.getLogger(__name__)


@shared_task
def ai_review_report(report_id: str) -> None:
    report = selectors.get_report(report_id=report_id)
    if report is None:
        return
    text = selectors.load_target_text(target_type=report.target_type, target_id=report.target_id)
    if not text:
        return
    try:
        verdict = review(text)
    except llm.LLMError:
        logger.warning("Modération IA indisponible pour le signalement %s", report_id)
        return
    services.store_ai_verdict(report_id=report_id, verdict=verdict)


@shared_task
def ai_screen_content(target_type: str, target_id: str, text: str) -> None:
    if not text.strip():
        return
    try:
        verdict = review(text)
    except llm.LLMError:
        return
    services.flag_from_screening(target_type=target_type, target_id=target_id, verdict=verdict)
