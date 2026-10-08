"""Prompts IA propres à la feature (fichiers .md de ce dossier)."""

from pathlib import Path

from core.prompts import load_prompt

_DIR = str(Path(__file__).parent)


def load(name: str) -> str:
    return load_prompt(_DIR, name)
