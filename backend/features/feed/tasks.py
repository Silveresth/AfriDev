"""Tâches Celery de la feature (préfixe ai_ pour la file « ai »)."""

import logging

import httpx
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from core import links
from integrations import llm

from . import selectors, services
from .prompts import load

logger = logging.getLogger(__name__)

# En dessous, le résumé IA n'apporterait rien de plus que la description de la page.
MIN_SUMMARY_CHARS = 400


@shared_task(soft_time_limit=40)
def fetch_link_preview(url: str) -> None:
    """Carte d'une ressource (file par défaut : surtout de l'attente réseau), puis résumé IA."""
    try:
        data = links.page(url)
    except (links.UnsafeURL, httpx.HTTPError, SoftTimeLimitExceeded, UnicodeError, ValueError):
        logger.info("Aperçu impossible pour %s", url)
        services.store_link_preview(url=url, data=None)
        return
    services.store_link_preview(url=url, data=data)
    source = data.get("text") or ""
    if llm.is_configured() and len(source) >= MIN_SUMMARY_CHARS:
        ai_summarize_link.delay(url, data.get("title") or "", source)


@shared_task
def ai_summarize_link(url: str, title: str, text: str) -> None:
    """Résumé en 3 points d'un article, dans la langue de l'article (modèle rapide)."""
    try:
        result = llm.complete_json(
            model=llm.FAST_MODEL,
            system=load("link_summary.md"),
            prompt=f"Titre : {title}\n\n{text[:6000]}",
            max_tokens=400,
        )
    except (llm.LLMError, SoftTimeLimitExceeded):
        logger.warning("Résumé IA indisponible pour %s", url)
        return
    points = result.get("points")
    if isinstance(points, list):
        services.store_link_summary(url=url, points=[" ".join(str(p).split()) for p in points])


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
