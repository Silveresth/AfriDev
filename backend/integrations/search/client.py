"""Recherche plein texte tolérante aux fautes : Meilisearch.

Sans MEILISEARCH_URL, `is_enabled()` renvoie False et les features retombent sur PostgreSQL.
"""

import logging
from functools import lru_cache

from django.conf import settings

logger = logging.getLogger(__name__)


class SearchError(Exception):
    pass


def is_enabled() -> bool:
    return bool(settings.MEILISEARCH_URL)


@lru_cache(maxsize=1)
def _client():
    import meilisearch

    return meilisearch.Client(settings.MEILISEARCH_URL, settings.MEILISEARCH_KEY or None)


def upsert(index: str, documents: list[dict], *, filterable: list[str] | None = None) -> None:
    if not is_enabled() or not documents:
        return
    try:
        target = _client().index(index)
        if filterable:
            target.update_filterable_attributes(filterable)
        target.add_documents(documents, primary_key="id")
    except Exception as exc:  # le SDK lève plusieurs types d'erreurs réseau
        raise SearchError(str(exc)) from exc


def remove(index: str, document_id: str) -> None:
    if not is_enabled():
        return
    try:
        _client().index(index).delete_document(document_id)
    except Exception as exc:
        raise SearchError(str(exc)) from exc


def search(index: str, query: str, *, limit: int = 20, filter: str | None = None) -> list[str]:
    """Renvoie les identifiants trouvés, du plus pertinent au moins pertinent."""
    params: dict = {"limit": limit, "attributesToRetrieve": ["id"]}
    if filter:
        params["filter"] = filter
    try:
        result = _client().index(index).search(query, params)
    except Exception as exc:
        raise SearchError(str(exc)) from exc
    return [hit["id"] for hit in result.get("hits", [])]
