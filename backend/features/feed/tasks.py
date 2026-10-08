"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from integrations import llm

from . import selectors, services
from .prompts import load

logger = logging.getLogger(__name__)


@shared_task
def ai_tag_post(post_id: str) -> None:
    """Tags automatiques (modèle rapide) pour les posts publiés sans tags."""
    post = selectors.get_post(post_id=post_id)
    if post is None or post.tags:
        return
    try:
        result = llm.complete_json(
            model=llm.FAST_MODEL, system=load("tags.md"), prompt=post.body[:2000], max_tokens=100
        )
    except llm.LLMError:
        logger.warning("Tags IA indisponibles pour le post %s", post_id)
        return
    tags = result.get("tags")
    if isinstance(tags, list) and tags:
        services.set_tags(post_id=post_id, tags=tags)
