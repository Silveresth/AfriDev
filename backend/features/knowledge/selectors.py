"""Lectures. Seul point d'entrée en lecture pour les autres features."""

import logging
from dataclasses import asdict, dataclass

from django.db import connection
from django.db.models import Q
from pgvector.django import CosineDistance

from integrations import embeddings, search

from .indexer import SEARCH_INDEX
from .models import Chunk, Document

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Hit:
    source_type: str
    source_id: str
    title: str
    url: str
    excerpt: str
    score: float

    def as_dict(self) -> dict:
        return asdict(self)


def _hit(chunk: Chunk, score: float) -> Hit:
    document = chunk.document
    return Hit(
        source_type=document.source_type,
        source_id=str(document.source_id),
        title=document.title,
        url=document.url,
        excerpt=chunk.text,
        score=round(score, 4),
    )


def semantic_search(
    *, query: str, limit: int = 5, source_types=None, exclude_source_ids=(), min_score: float = 0.0
) -> list[Hit]:
    """Recherche par le sens : un résultat par document, du plus proche au plus lointain."""
    if not query.strip():
        return []
    vector = embeddings.embed_one(query, input_type="query")
    chunks = Chunk.objects.select_related("document").filter(document__deleted_at__isnull=True)
    if source_types:
        chunks = chunks.filter(document__source_type__in=source_types)
    if exclude_source_ids:
        chunks = chunks.exclude(document__source_id__in=list(exclude_source_ids))

    if connection.vendor == "postgresql":
        ranked = [
            (chunk, 1 - chunk.distance)
            for chunk in chunks.annotate(distance=CosineDistance("embedding", vector)).order_by(
                "distance"
            )[: limit * 4]
        ]
    else:  # SQLite (tests) : calcul en Python
        ranked = sorted(
            ((chunk, embeddings.cosine_similarity(vector, chunk.embedding)) for chunk in chunks),
            key=lambda pair: pair[1],
            reverse=True,
        )

    hits, seen = [], set()
    for chunk, score in ranked:
        if score < min_score or chunk.document_id in seen:
            continue
        seen.add(chunk.document_id)
        hits.append(_hit(chunk, score))
        if len(hits) == limit:
            break
    return hits


def fulltext_search(*, query: str, limit: int = 20, source_type: str | None = None) -> list[Hit]:
    """Recherche tolérante aux fautes (Meilisearch), repli sur PostgreSQL sinon."""
    if not query.strip():
        return []
    documents = Document.objects.alive()
    ids = None
    if search.is_enabled():
        try:
            ids = search.search(
                SEARCH_INDEX,
                query,
                limit=limit,
                filter=f'source_type = "{source_type}"' if source_type else None,
            )
        except search.SearchError:
            logger.warning("Meilisearch indisponible, repli sur la base de données.")
    if ids is not None:
        by_id = {str(d.id): d for d in documents.filter(id__in=ids)}
        ordered = [by_id[i] for i in ids if i in by_id]
    else:
        if source_type:
            documents = documents.filter(source_type=source_type)
        ordered = list(
            documents.filter(Q(title__icontains=query) | Q(content__icontains=query))[:limit]
        )
    return [
        Hit(
            source_type=d.source_type,
            source_id=str(d.source_id),
            title=d.title,
            url=d.url,
            excerpt=d.content[:300],
            score=1.0,
        )
        for d in ordered
    ]


def is_indexed(*, source_type: str, source_id) -> bool:
    return Document.objects.alive().filter(source_type=source_type, source_id=source_id).exists()
