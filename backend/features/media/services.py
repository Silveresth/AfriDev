"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

import mimetypes
from pathlib import PurePath

from django.conf import settings
from django.db import transaction

from core.exceptions import DomainError
from integrations import storage

from .events import media_ready
from .models import MediaAsset

ALLOWED_TYPES = {
    MediaAsset.Kind.IMAGE: {"image/jpeg", "image/png", "image/webp", "image/gif"},
    MediaAsset.Kind.VIDEO: {"video/mp4", "video/quicktime", "video/webm", "video/3gpp"},
    MediaAsset.Kind.AUDIO: {
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
        "audio/aac",
        "audio/mpeg",
        "audio/ogg",
        "audio/opus",
        "audio/webm",
        "audio/wav",
        "audio/x-wav",
        "audio/3gpp",
    },
}
# Plafonds par type, en Mo (la vidéo est déjà compressée sur le téléphone avant l'envoi).
MAX_SIZE_MB = {MediaAsset.Kind.IMAGE: 10, MediaAsset.Kind.AUDIO: 10}


class InvalidMediaError(DomainError):
    code = "invalid_media"


def _base_path(asset: MediaAsset) -> str:
    return f"media/{asset.owner_id}/{asset.id}"


@transaction.atomic
def upload_media(*, owner, kind: str, uploaded_file) -> MediaAsset:
    mime_type = uploaded_file.content_type or mimetypes.guess_type(uploaded_file.name)[0] or ""
    if mime_type not in ALLOWED_TYPES.get(kind, set()):
        raise InvalidMediaError(f"Type de fichier non accepté pour « {kind} » : {mime_type}.")
    max_mb = MAX_SIZE_MB.get(kind, settings.MEDIA_MAX_UPLOAD_MB)
    if uploaded_file.size > max_mb * 1024 * 1024:
        raise InvalidMediaError(f"Fichier trop lourd (maximum {max_mb} Mo).")

    asset = MediaAsset(owner=owner, kind=kind, mime_type=mime_type, size_bytes=uploaded_file.size)
    suffix = PurePath(uploaded_file.name).suffix.lower()[:10]
    asset.original_path = storage.save(
        f"{_base_path(asset)}/original{suffix}", uploaded_file.read()
    )
    asset.save()

    from .tasks import transcode_media

    transaction.on_commit(lambda: transcode_media.delay(str(asset.id)))
    return asset


def mark_ready(*, asset: MediaAsset, result) -> MediaAsset:
    asset.status = MediaAsset.Status.READY
    asset.variants = result.variants
    asset.width = result.width
    asset.height = result.height
    asset.duration_seconds = result.duration_seconds
    asset.thumbhash = result.thumbhash
    asset.error = ""
    asset.save()
    media_ready.send(sender=MediaAsset, asset_id=asset.id, owner_id=asset.owner_id, kind=asset.kind)
    return asset


def mark_failed(*, asset: MediaAsset, error: str) -> None:
    asset.status = MediaAsset.Status.FAILED
    asset.error = error[:2000]
    asset.save(update_fields=["status", "error", "updated_at"])


def delete_media(*, asset: MediaAsset) -> None:
    asset.soft_delete()
    # Les segments HLS (dossier hls/) sont purgés par préfixe côté stockage objet.
    paths = [asset.original_path] + [p for name, p in asset.variants.items() if name != "hls"]

    def _purge():
        for path in paths:
            storage.delete(path)

    transaction.on_commit(_purge)
