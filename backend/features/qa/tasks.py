"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from core import jobs
from integrations import llm

from . import rag_answer, rephraser, selectors, services, voice
from .models import Question
from .prompts import load

logger = logging.getLogger(__name__)


@shared_task
def ai_answer_question(question_id: str, force: bool = False) -> None:
    question = selectors.get_question(question_id=question_id)
    if question is None:
        return
    if question.ai_answer_status == Question.AiStatus.READY and not force:
        return
    try:
        text, sources = rag_answer.answer(question)
    except llm.LLMUnavailableError:
        services.store_ai_answer(question_id=question_id, answer=None, sources=[], disabled=True)
        return
    except llm.LLMError:
        logger.warning("Réponse IA impossible pour la question %s", question_id)
        text, sources = None, []
    services.store_ai_answer(question_id=question_id, answer=text, sources=sources)


@shared_task
def ai_tag_question(question_id: str) -> None:
    question = selectors.get_question(question_id=question_id)
    if question is None or question.tags:
        return
    try:
        result = llm.complete_json(
            model=llm.FAST_MODEL,
            system=load("tags.md"),
            prompt=f"{question.title}\n\n{question.body[:3000]}",
            max_tokens=100,
        )
    except llm.LLMError:
        return
    if isinstance(result.get("tags"), list):
        services.set_tags(question_id=question_id, tags=result["tags"])


@shared_task
def ai_rephrase(*, job_id: str, title: str, body: str) -> None:
    try:
        jobs.finish_job(job_id, rephraser.rephrase(title=title, body=body))
    except llm.LLMError as exc:
        logger.warning("Reformulation impossible : %s", exc)
        jobs.fail_job(job_id, "La reformulation est indisponible pour le moment.")


@shared_task
def ai_transcribe_voice(*, job_id: str, media_id: str, language: str | None) -> None:
    """File « ai » : la transcription a un coût, comme les appels au modèle."""
    try:
        text = voice.transcribe_question(media_id=media_id, language=language)
    except voice.VoiceError as exc:
        jobs.fail_job(job_id, str(exc))
        return
    jobs.finish_job(job_id, {"text": text})
