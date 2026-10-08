"""Tâches Celery de la feature (file « default » : le transcodage n'est pas de l'IA)."""

import logging

from celery import shared_task

from . import services
from .models import MediaAsset
from .transcoding import TRANSCODERS, TranscodingError

logger = logging.getLogger(__name__)


@shared_task(acks_late=True)
def transcode_media(asset_id: str) -> None:
    asset = MediaAsset.objects.alive().filter(id=asset_id).first()
    if asset is None:
        return
    base = asset.original_path.rsplit("/", 1)[0]
    try:
        result = TRANSCODERS[asset.kind](asset.original_path, base)
    except (TranscodingError, OSError, ValueError) as exc:
        logger.exception("Transcodage impossible pour %s", asset_id)
        services.mark_failed(asset=asset, error=str(exc))
        return
    services.mark_ready(asset=asset, result=result)
