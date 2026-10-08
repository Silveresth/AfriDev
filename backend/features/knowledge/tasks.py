"""Tâches Celery de la feature (préfixe ai_ pour la file « ai » : les embeddings coûtent)."""

from celery import shared_task

from integrations.embeddings import EmbeddingError

from . import services

_RETRY = {"autoretry_for": (EmbeddingError,), "retry_backoff": True, "max_retries": 5}


@shared_task(**_RETRY)
def ai_index_snippet(snippet_id: str) -> None:
    services.index_snippet(snippet_id=snippet_id)


@shared_task(**_RETRY)
def ai_index_question(question_id: str) -> None:
    services.index_question(question_id=question_id)


@shared_task(**_RETRY)
def ai_index_project(project_id: str) -> None:
    services.index_project(project_id=project_id)


@shared_task
def remove_source(source_type: str, source_id: str) -> None:
    services.remove(source_type=source_type, source_id=source_id)
