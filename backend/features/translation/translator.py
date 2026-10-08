"""Traduction et vulgarisation d'un contenu technique (modèle rapide)."""

from integrations import llm

from .models import Translation
from .prompts import load


def run(translation: Translation) -> str:
    language = Translation.Language(translation.target_language).label
    prompt_name = "simplify.md" if translation.mode == Translation.Mode.SIMPLIFY else "translate.md"
    completion = llm.complete(
        model=llm.FAST_MODEL,
        system=load(prompt_name),
        prompt=f"Langue cible : {language}\n\n---\n{translation.source_text}",
        max_tokens=2048,
        temperature=0.2,
    )
    return completion.text.strip()
