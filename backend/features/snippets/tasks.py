"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

from celery import shared_task

from integrations import llm

from . import selectors, services
from .prompts import load

logger = logging.getLogger(__name__)

MAX_CODE_CHARS = 12000


@shared_task
def ai_analyze_snippet(snippet_id: str) -> None:
    """Étage 2 du Security Guard + tags automatiques (modèle rapide)."""
    snippet = selectors.get_public_snippet(snippet_id=snippet_id)
    if snippet is None:
        return
    prompt = (
        f"Titre : {snippet.title}\nLangage : {snippet.language}\n\n"
        f"```{snippet.language}\n{snippet.content[:MAX_CODE_CHARS]}\n```"
    )
    try:
        result = llm.complete_json(
            model=llm.FAST_MODEL, system=load("security_review.md"), prompt=prompt, max_tokens=300
        )
    except llm.LLMError:
        logger.warning("Analyse IA indisponible pour le snippet %s", snippet_id)
        return

    reasons = result.get("reasons") if isinstance(result.get("reasons"), list) else []
    tags = result.get("tags") if isinstance(result.get("tags"), list) else []
    services.store_ai_review(
        snippet_id=snippet_id,
        risky=bool(result.get("risky")),
        reasons=[str(reason) for reason in reasons],
        tags=[str(tag) for tag in tags],
    )
