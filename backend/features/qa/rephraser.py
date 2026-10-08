"""Reformulation IA d'une question avant publication (modèle rapide)."""

from integrations import llm

from .prompts import load


def rephrase(*, title: str, body: str) -> dict:
    result = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("rephrase.md"),
        prompt=f"Titre : {title}\n\nCorps :\n{body[:6000]}",
        max_tokens=1200,
        temperature=0.3,
    )
    new_title = str(result.get("title") or title).strip()[:200]
    new_body = str(result.get("body") or body).strip()
    return {"title": new_title, "body": new_body}
