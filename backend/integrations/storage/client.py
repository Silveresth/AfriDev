"""Stockage objet et URLs publiques (CDN).

S'appuie sur le stockage Django (`STORAGES["default"]`) : système de fichiers en dev,
S3 / R2 en production via django-storages, sans changer le code des features.
"""

import tempfile
from contextlib import contextmanager
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def save(path: str, content: bytes) -> str:
    """Enregistre le contenu et renvoie le chemin effectif (suffixé si déjà pris)."""
    return default_storage.save(path, ContentFile(content))


def save_file(path: str, local_file: Path) -> str:
    with open(local_file, "rb") as handle:
        return default_storage.save(path, handle)


def read(path: str) -> bytes:
    with default_storage.open(path, "rb") as handle:
        return handle.read()


def delete(path: str) -> None:
    if path and default_storage.exists(path):
        default_storage.delete(path)


def public_url(path: str) -> str:
    if not path:
        return ""
    if settings.MEDIA_CDN_URL:
        return f"{settings.MEDIA_CDN_URL.rstrip('/')}/{path.lstrip('/')}"
    return default_storage.url(path)


@contextmanager
def local_copy(path: str, suffix: str = ""):
    """Copie temporaire sur disque (ffmpeg et Pillow travaillent sur des fichiers)."""
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / f"source{suffix}"
        target.write_bytes(read(path))
        yield target
