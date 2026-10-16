"""Stockage objet et URLs publiques (CDN).

S'appuie sur le stockage Django (`STORAGES["default"]`) : système de fichiers en dev,
Cloudflare R2 (API S3) en production via django-storages, sans changer le code des features.
"""

import shutil
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class PresignedUpload:
    """Requête que le client doit rejouer telle quelle pour envoyer le fichier."""

    method: str
    url: str
    headers: dict


@dataclass(frozen=True)
class ObjectInfo:
    size: int
    content_type: str


def is_remote() -> bool:
    """Vrai quand les fichiers vivent sur R2 (envoi direct par URL pré-signée)."""
    return settings.USE_R2_STORAGE


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
    if not path:
        return
    # Sur R2, DELETE est idempotent : inutile de payer un HEAD « exists » avant.
    if is_remote() or default_storage.exists(path):
        default_storage.delete(path)


def stat(path: str) -> ObjectInfo | None:
    """Taille et type d'un objet sans le télécharger (HEAD sur R2)."""
    if is_remote():
        from botocore.exceptions import ClientError

        client = default_storage.connection.meta.client
        try:
            head = client.head_object(Bucket=settings.R2_BUCKET_NAME, Key=path)
        except ClientError:
            return None
        return ObjectInfo(size=head["ContentLength"], content_type=head.get("ContentType", ""))
    if not default_storage.exists(path):
        return None
    return ObjectInfo(size=default_storage.size(path), content_type="")


def presigned_upload(path: str, *, content_type: str, size_bytes: int) -> PresignedUpload | None:
    """URL PUT pré-signée vers R2. Le type et la taille exacte sont signés : le client ne
    peut pas envoyer un autre fichier que celui déclaré. None hors R2 (dev local)."""
    if not is_remote():
        return None
    client = default_storage.connection.meta.client
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": path,
            "ContentType": content_type,
            "ContentLength": size_bytes,
        },
        ExpiresIn=settings.MEDIA_PRESIGN_EXPIRES,
        HttpMethod="PUT",
    )
    return PresignedUpload(method="PUT", url=url, headers={"Content-Type": content_type})


def public_url(path: str) -> str:
    if not path:
        return ""
    if settings.MEDIA_CDN_URL:
        return f"{settings.MEDIA_CDN_URL.rstrip('/')}/{path.lstrip('/')}"
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
