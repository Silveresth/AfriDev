"""Résumé IA d'un fil de commentaires en 3 points (modèle rapide)."""

from integrations import llm

from .prompts import load

MAX_PROMPT_CHARS = 12000


def summarize(comments: list[str]) -> list[str]:
    lines, size = [], 0
    for index, body in enumerate(comments, start=1):
        line = f"{index}. {body.strip()}"
        size += len(line)
        if size > MAX_PROMPT_CHARS:
            break
        lines.append(line)

    result = llm.complete_json(
        model=llm.FAST_MODEL, system=load("summary.md"), prompt="\n".join(lines), max_tokens=300
    )
    points = result.get("points")
    if not isinstance(points, list):
        raise llm.LLMError("Résumé sans points.")
    return [str(point).strip() for point in points if str(point).strip()][:3]
