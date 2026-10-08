"""Réponse instantanée (RAG) : interroge knowledge puis rédige avec le modèle « smart »."""

from features.knowledge import selectors as knowledge_selectors
from integrations import llm

from .models import Question
from .prompts import load

MAX_SOURCES = 5
MIN_SCORE = 0.25
MAX_SOURCE_CHARS = 1500


def answer(question: Question) -> tuple[str, list[dict]]:
    """Renvoie (réponse Markdown, sources citées)."""
    query = f"{question.title}\n\n{question.body}"
    hits = knowledge_selectors.semantic_search(
        query=query,
        limit=MAX_SOURCES,
        source_types=["question", "snippet"],
        exclude_source_ids=[question.id],
        min_score=MIN_SCORE,
    )

    context = "\n\n".join(
        f"[{i}] {hit.title} ({hit.source_type})\n{hit.excerpt[:MAX_SOURCE_CHARS]}"
        for i, hit in enumerate(hits, start=1)
    )
    prompt = (
        f"Sources :\n{context or '(aucune source pertinente dans la base)'}\n\n"
        f"---\nQuestion : {question.title}\n\n{question.body}"
    )
    completion = llm.complete(
        model=llm.SMART_MODEL,
        system=load("rag_answer.md"),
        prompt=prompt,
        max_tokens=900,
        temperature=0.2,
    )
    text = completion.text.strip()
    cited = [
        {"source_type": h.source_type, "source_id": h.source_id, "title": h.title, "url": h.url}
        for i, h in enumerate(hits, start=1)
        if f"[{i}]" in text
    ]
    return text, cited
