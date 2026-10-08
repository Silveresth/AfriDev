"""Modération IA des contenus signalés ou nouvellement publiés (modèle rapide)."""

from integrations import llm

from .prompts import load

MAX_CHARS = 4000


def review(text: str) -> dict:
    result = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("moderation.md"),
        prompt=text[:MAX_CHARS],
        max_tokens=150,
        temperature=0.0,
    )
    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "violates": bool(result.get("violates")),
        "category": str(result.get("category") or "none"),
        "confidence": max(0.0, min(1.0, confidence)),
        "explanation": str(result.get("explanation") or "")[:300],
    }
