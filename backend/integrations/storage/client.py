"""Stockage local des médias (développement et tests, sans Cloudinary).

En production, les médias vivent sur Cloudinary (integrations.cloudinary) : ce module ne sert
plus qu'au disque local, via le stockage Django (`STORAGES["default"]`).
"""

import shutil
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

from django.core.files import File
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class PresignedUpload:
    """Requête que le client doit rejouer pour envoyer le fichier : corps brut (PUT) ou
    formulaire multipart (POST, `fields` + le fichier dans `file_field`)."""

    method: str
    url: str
    headers: dict = field(default_factory=dict)
    fields: dict = field(default_factory=dict)
    file_field: str = ""


@dataclass(frozen=True)
class ObjectInfo:
    size: int
    content_type: str


def save(path: str, content: bytes) -> str:
    """Enregistre le contenu et renvoie le chemin effectif (suffixé si déjà pris)."""
    return default_storage.save(path, ContentFile(content))


def save_file(path: str, local_file: Path) -> str:
    with open(local_file, "rb") as handle:
        return default_storage.save(path, File(handle))


def save_stream(path: str, stream) -> str:
    """Enregistre un flux (fichier reçu, corps de requête) morceau par morceau."""
    return default_storage.save(path, stream if isinstance(stream, File) else File(stream))


def read(path: str) -> bytes:
    with default_storage.open(path, "rb") as handle:
        return handle.read()


def delete(path: str) -> None:
    if path and default_storage.exists(path):
        default_storage.delete(path)


def stat(path: str) -> ObjectInfo | None:
    if not default_storage.exists(path):
        return None
    return ObjectInfo(size=default_storage.size(path), content_type="")


def public_url(path: str) -> str:
    """URL publique d'un chemin local ; une URL absolue (Cloudinary) est renvoyée telle quelle."""
    if not path:
        return ""
    if path.startswith(("http://", "https://")):
        return path
    return default_storage.url(path)


@contextmanager
def local_copy(path: str, suffix: str = ""):
    """Copie temporaire sur disque (ffmpeg et Pillow travaillent sur des fichiers).

    Copiée par morceaux : une vidéo de 50 Mo ne passe jamais entière en mémoire.
    """
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / f"source{suffix}"
        with default_storage.open(path, "rb") as source, open(target, "wb") as out:
            shutil.copyfileobj(source, out, CHUNK_SIZE)
        yield target
