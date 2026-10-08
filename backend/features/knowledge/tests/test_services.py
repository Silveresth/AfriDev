import uuid

import pytest

from features.knowledge import indexer, selectors
from features.knowledge.indexer import CHUNK_CHARS, split_text
from features.knowledge.models import Chunk

pytestmark = pytest.mark.django_db(transaction=True)


def test_split_text_keeps_chunks_bounded():
    text = "\n\n".join(f"Paragraphe {i} " + "mot " * 80 for i in range(20))
    chunks = split_text(text)
    assert len(chunks) > 1
    assert all(len(chunk) <= CHUNK_CHARS + 210 for chunk in chunks)
    assert split_text("court") == ["court"]
    assert split_text("") == []


def test_semantic_search_ranks_relevant_document_first():
    django_doc = uuid.uuid4()
    indexer.index_document(
        source_type="question",
        source_id=django_doc,
        title="Migrations Django lentes",
        text="Comment accélérer les migrations Django sur PostgreSQL ?",
    )
    indexer.index_document(
        source_type="question",
        source_id=uuid.uuid4(),
        title="Animation Flutter",
        text="Pourquoi mon animation Flutter saccade sur Android ?",
    )
    hits = selectors.semantic_search(query="migrations django postgresql", limit=2)
    assert hits[0].source_id == str(django_doc)


def test_reindex_skips_unchanged_content_and_remove_cleans_up():
    source_id = uuid.uuid4()
    first = indexer.index_document(source_type="project", source_id=source_id, title="A", text="B")
    chunk_ids = set(Chunk.objects.values_list("id", flat=True))
    indexer.index_document(source_type="project", source_id=source_id, title="A", text="B")
    assert set(Chunk.objects.values_list("id", flat=True)) == chunk_ids

    indexer.remove_document(source_type="project", source_id=source_id)
    assert not selectors.is_indexed(source_type="project", source_id=first.source_id)
    assert not Chunk.objects.exists()


def test_fulltext_fallback_without_meilisearch():
    indexer.index_document(
        source_type="snippet", source_id=uuid.uuid4(), title="Envoi SMS", text="Africa's Talking"
    )
    hits = selectors.fulltext_search(query="sms")
    assert [hit.title for hit in hits] == ["Envoi SMS"]
