"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

import mimetypes
from datetime import timedelta
from pathlib import PurePath

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone

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
LOCAL_UPLOAD_SALT = "media.local-upload"
# Un envoi pré-signé non confirmé au-delà de ce délai est purgé.
STALE_UPLOAD_AFTER = timedelta(days=1)


class InvalidMediaError(DomainError):
    code = "invalid_media"


def _base_path(asset: MediaAsset) -> str:
    return f"media/{asset.owner_id}/{asset.id}"


def _validate(*, kind: str, mime_type: str, size_bytes: int) -> None:
    if mime_type not in ALLOWED_TYPES.get(kind, set()):
        raise InvalidMediaError(f"Type de fichier non accepté pour « {kind} » : {mime_type}.")
    max_mb = MAX_SIZE_MB.get(kind, settings.MEDIA_MAX_UPLOAD_MB)
    if size_bytes <= 0 or size_bytes > max_mb * 1024 * 1024:
        raise InvalidMediaError(f"Fichier vide ou trop lourd (maximum {max_mb} Mo).")


def _new_asset(*, owner, kind: str, mime_type: str, size_bytes: int, filename: str, status: str):
    asset = MediaAsset(
        owner=owner, kind=kind, mime_type=mime_type, size_bytes=size_bytes, status=status
    )
    suffix = PurePath(filename).suffix.lower()[:10] or (mimetypes.guess_extension(mime_type) or "")
    asset.original_path = f"{_base_path(asset)}/original{suffix}"
    return asset


def _schedule_transcoding(asset: MediaAsset) -> None:
    from .tasks import transcode_media

    transaction.on_commit(lambda: transcode_media.delay(str(asset.id)))


# ── Envoi direct vers le stockage objet (URL pré-signée) ──


@transaction.atomic
def start_upload(*, owner, kind: str, mime_type: str, size_bytes: int, filename: str):
    """Réserve un média et renvoie (média, URL pré-signée R2 ou None en dev local).

    Le fichier ne passe jamais par le serveur : le client l'envoie directement à R2,
    puis appelle `complete_upload`.
    """
    _validate(kind=kind, mime_type=mime_type, size_bytes=size_bytes)
    asset = _new_asset(
        owner=owner,
        kind=kind,
        mime_type=mime_type,
        size_bytes=size_bytes,
        filename=filename,
        status=MediaAsset.Status.UPLOADING,
    )
    asset.save()
    upload = storage.presigned_upload(
        asset.original_path, content_type=mime_type, size_bytes=size_bytes
    )
    return asset, upload


def local_upload_token(asset: MediaAsset) -> str:
    """Jeton signé de l'envoi local (dev sans R2), valable comme une URL pré-signée."""
    return signing.dumps(str(asset.id), salt=LOCAL_UPLOAD_SALT)


def asset_id_from_local_token(token: str) -> str | None:
    try:
        return signing.loads(token, salt=LOCAL_UPLOAD_SALT, max_age=settings.MEDIA_PRESIGN_EXPIRES)
    except signing.BadSignature:
        return None


def receive_local_upload(*, asset: MediaAsset, stream) -> None:
    """Dev uniquement : imite le PUT vers R2 en écrivant le corps de la requête sur disque."""
    if asset.status != MediaAsset.Status.UPLOADING:
        raise InvalidMediaError("Cet envoi est déjà terminé.")
    # Comme R2 (Content-Length signé), on n'accepte pas plus que la taille déclarée.
    storage.save_stream(asset.original_path, _LimitedReader(stream, asset.size_bytes))


class _LimitedReader:
    def __init__(self, stream, limit: int):
        self._stream = stream
        self._remaining = limit

    def read(self, size: int = -1) -> bytes:
        if self._remaining <= 0:
            return b""
        size = self._remaining if size is None or size < 0 else min(size, self._remaining)
        data = self._stream.read(size)
        self._remaining -= len(data)
        return data


def complete_upload(*, asset: MediaAsset) -> MediaAsset:
    """Vérifie l'objet reçu (HEAD, sans le télécharger) puis lance le transcodage."""
    if asset.status != MediaAsset.Status.UPLOADING:
        return asset  # idempotent : un double appel du client ne relance rien
    info = storage.stat(asset.original_path)
    if info is None:
        raise InvalidMediaError("Fichier non reçu : relancez l'envoi.")
    max_mb = MAX_SIZE_MB.get(asset.kind, settings.MEDIA_MAX_UPLOAD_MB)
    if info.size > max_mb * 1024 * 1024:
        storage.delete(asset.original_path)
        mark_failed(asset=asset, error="Fichier trop lourd.")
        raise InvalidMediaError(f"Fichier trop lourd (maximum {max_mb} Mo).")
    with transaction.atomic():
        asset.size_bytes = info.size
        asset.status = MediaAsset.Status.PROCESSING
        asset.save(update_fields=["size_bytes", "status", "updated_at"])
        _schedule_transcoding(asset)
    return asset


def purge_stale_uploads(*, older_than: timedelta = STALE_UPLOAD_AFTER) -> int:
    """Supprime les réservations jamais confirmées (et l'éventuel fichier orphelin)."""
    stale = MediaAsset.objects.filter(
        status=MediaAsset.Status.UPLOADING, created_at__lt=timezone.now() - older_than
    )
    paths = list(stale.values_list("original_path", flat=True))
    for path in paths:
        storage.delete(path)
    deleted, _ = stale.delete()
    return deleted


# ── Envoi multipart (historique : le fichier transite par le serveur) ──


@transaction.atomic
def upload_media(*, owner, kind: str, uploaded_file) -> MediaAsset:
    mime_type = uploaded_file.content_type or mimetypes.guess_type(uploaded_file.name)[0] or ""
    _validate(kind=kind, mime_type=mime_type, size_bytes=uploaded_file.size)
    asset = _new_asset(
        owner=owner,
        kind=kind,
        mime_type=mime_type,
        size_bytes=uploaded_file.size,
        filename=uploaded_file.name,
        status=MediaAsset.Status.PROCESSING,
    )
    # Copie par morceaux : le fichier n'est jamais chargé entier en mémoire.
    asset.original_path = storage.save_stream(asset.original_path, uploaded_file)
    asset.save()
    _schedule_transcoding(asset)
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
