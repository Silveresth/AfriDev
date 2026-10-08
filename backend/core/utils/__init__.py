"""Petits utilitaires techniques partagés."""

import hashlib
import json
from typing import Any


def content_hash(*parts: str) -> str:
    """Empreinte stable d'un contenu (clés de cache, déduplication)."""
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode("utf-8"))
        digest.update(b"\x00")
    return digest.hexdigest()


def parse_json_list(value: Any) -> list:
    """Accepte une liste ou sa forme JSON texte (colonnes JSON de la copie locale SQLite)."""
    if value in (None, ""):
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [item.strip() for item in value.split(",") if item.strip()]
        return parsed if isinstance(parsed, list) else []
    return []


def normalize_tags(tags: Any, *, limit: int = 8) -> list[str]:
    """Tags en minuscules, sans doublons, ordre conservé."""
    seen: list[str] = []
    for tag in parse_json_list(tags):
        cleaned = str(tag).strip().lower().lstrip("#")[:30]
        if cleaned and cleaned not in seen:
            seen.append(cleaned)
    return seen[:limit]
