"""Modération IA des contenus signalés ou nouvellement publiés (modèle rapide)."""

from integrations import llm

from .prompts import load

MAX_CHARS = 4000
CATEGORIES = {
    "insult",
    "harassment",
    "hate",
    "sexual",
    "spam",
    "scam",
    "personal_data",
    "illegal",
    "abuse",  # ancien nom, gardé pour les verdicts déjà enregistrés
    "none",
}
KIND_LABELS = {
    "post": "post",
    "comment": "commentaire",
    "question": "question",
    "answer": "réponse d'entraide",
    "job": "offre d'emploi",
    "target_comment": "commentaire",
    "snippet_comment": "commentaire de snippet",
}


def review(text: str, kind: str = "") -> dict:
    label = KIND_LABELS.get(kind, "contenu")
    result = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("moderation.md"),
        prompt=f"TYPE : {label}\n\nTEXTE :\n{text[:MAX_CHARS]}",
        max_tokens=200,
        temperature=0.0,
    )
    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    category = str(result.get("category") or "none")
    return {
        "violates": bool(result.get("violates")),
        "category": category if category in CATEGORIES else "none",
        "confidence": max(0.0, min(1.0, confidence)),
        "explanation": str(result.get("explanation") or "")[:300],
    }
