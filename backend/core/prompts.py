"""Chargement des prompts IA rangés en fichiers .md dans features/<nom>/prompts/."""

from functools import cache
from pathlib import Path


@cache
def load_prompt(directory: str, name: str) -> str:
    return (Path(directory) / name).read_text(encoding="utf-8").strip()
