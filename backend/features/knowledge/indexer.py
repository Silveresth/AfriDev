"""Découpe, embeddings (integrations.embeddings) et écriture dans pgvector / Meilisearch."""

import logging
import re

from django.db import transaction

from core.utils import content_hash
from integrations import embeddings, search

from .models import Chunk, Document

logger = logging.getLogger(__name__)

SEARCH_INDEX = "knowledge"
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 200


def split_text(text: str) -> list[str]:
    """Morceaux de ~1200 caractères, coupés entre paragraphes quand c'est possible."""
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    if len(text) <= CHUNK_CHARS:
        return [text] if text else []

    chunks, current = [], ""
    for paragraph in text.split("\n\n"):
        while len(paragraph) > CHUNK_CHARS:  # paragraphe (ou bloc de code) trop long
            if current:
                chunks.append(current)
                current = ""
            chunks.append(paragraph[:CHUNK_CHARS])
            paragraph = paragraph[CHUNK_CHARS - CHUNK_OVERLAP :]
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if len(candidate) > CHUNK_CHARS:
            chunks.append(current)
            tail = current[-CHUNK_OVERLAP:]
            current = f"{tail}\n\n{paragraph}"
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def index_document(
    *, source_type: str, source_id, title: str, text: str, url: str = ""
) -> Document:
    """Crée ou met à jour le document ; recalcule les embeddings seulement si le texte a changé."""
    full_text = f"{title}\n\n{text}".strip()
    digest = content_hash(full_text)
    document = Document.objects.filter(source_type=source_type, source_id=source_id).first()
    if document and document.content_hash == digest and document.deleted_at is None:
        return document

    pieces = split_text(full_text)
    vectors = embeddings.embed(pieces, input_type="document")

    with transaction.atomic():
        if document is None:
            document = Document(source_type=source_type, source_id=source_id)
        document.title = title[:200]
        document.url = url
        document.content = full_text
        document.content_hash = digest
        document.deleted_at = None
        document.save()
        document.chunks.all().delete()
        Chunk.objects.bulk_create(
            Chunk(document=document, position=i, text=piece, embedding=vector)
            for i, (piece, vector) in enumerate(zip(pieces, vectors, strict=True))
        )

    try:
        search.upsert(
            SEARCH_INDEX,
            [
                {
                    "id": str(document.id),
                    "title": document.title,
                    "content": full_text[:20000],
                    "source_type": source_type,
                }
            ],
            filterable=["source_type"],
        )
    except search.SearchError:
        logger.warning("Meilisearch indisponible : %s indexé dans pgvector seulement.", source_id)
    return document


def remove_document(*, source_type: str, source_id) -> None:
    document = Document.objects.filter(source_type=source_type, source_id=source_id).first()
    if document is None:
        return
    document.chunks.all().delete()
    document.soft_delete()
    try:
        search.remove(SEARCH_INDEX, str(document.id))
    except search.SearchError:
        logger.warning("Meilisearch indisponible : suppression de %s différée.", source_id)
