"""Médias sur Cloudinary : identifiant du fichier, vérification de l'envoi, variantes servies à
la volée par le CDN (aucun transcodage sur le VPS) et aperçu ThumbHash.

Les noms des variantes restent ceux du transcodage local (small, large, avif, hls, poster,
opus) : le web et le mobile n'ont rien à changer.
"""

import io
import logging

from django.conf import settings
from PIL import Image

from integrations import cloudinary

from .models import MediaAsset
from .thumbhash import image_to_thumbhash_b64
from .transcoding import TranscodeResult

logger = logging.getLogger(__name__)

# Vignette téléchargée pour calculer l'aperçu flou : quelques Ko au plus.
THUMB = "c_limit,w_100,h_100"
THUMB_MAX_BYTES = 512 * 1024
# Vidéos : rendu HLS adaptatif préparé dès l'envoi (le premier visionnage n'attend pas).
VIDEO_EAGER = "sp_auto/m3u8"


def resource_type(asset: MediaAsset) -> str:
    return cloudinary.RESOURCE_TYPES[asset.kind]


def public_id(asset: MediaAsset) -> str:
    """Emplacement imposé du fichier : un membre ne peut écrire que dans son propre dossier."""
    return f"{settings.CLOUDINARY_FOLDER}/media/{asset.owner_id}/{asset.id}"


def signed_upload(asset: MediaAsset) -> cloudinary.SignedUpload:
    eager = VIDEO_EAGER if asset.kind == MediaAsset.Kind.VIDEO else ""
    return cloudinary.signed_upload(
        public_id=public_id(asset), resource_type=resource_type(asset), eager=eager
    )


def received(asset: MediaAsset) -> cloudinary.ResourceInfo | None:
    return cloudinary.resource(public_id=public_id(asset), resource_type=resource_type(asset))


def destroy(asset: MediaAsset) -> None:
    try:
        cloudinary.destroy(public_id=public_id(asset), resource_type=resource_type(asset))
    except cloudinary.CloudinaryError:
        logger.warning("Suppression Cloudinary impossible pour %s (à purger plus tard).", asset.id)


def _url(asset: MediaAsset, transformation: str = "", fmt: str = "") -> str:
    return cloudinary.delivery_url(
        public_id=public_id(asset),
        resource_type=resource_type(asset),
        transformation=transformation,
        fmt=fmt,
    )


def variants(asset: MediaAsset) -> dict:
    """URLs des variantes, produites à la volée puis mises en cache par le CDN de Cloudinary."""
    if asset.kind == MediaAsset.Kind.IMAGE:
        return {
            "small": _url(asset, "c_limit,w_480,f_webp,q_auto"),
            "large": _url(asset, "c_limit,w_1280,f_webp,q_auto"),
            "avif": _url(asset, "c_limit,w_1280,f_avif,q_auto"),
        }
    if asset.kind == MediaAsset.Kind.VIDEO:
        return {
            "hls": _url(asset, "sp_auto", "m3u8"),
            "poster": _url(asset, "so_0.5,c_limit,w_720,q_auto", "webp"),
            # Lecture directe si HLS est indisponible (MP4 H.264 720p).
            "mp4": _url(asset, "c_limit,h_720,q_auto,vc_h264", "mp4"),
        }
    # Message vocal : MP3 léger, lu partout (y compris Safari, qui ignore l'Ogg/Opus).
    return {"opus": _url(asset, "br_32k", "mp3")}


def _thumbhash(asset: MediaAsset) -> str:
    if asset.kind == MediaAsset.Kind.AUDIO:
        return ""
    url = (
        _url(asset, THUMB, "jpg")
        if asset.kind == MediaAsset.Kind.VIDEO
        else _url(asset, f"{THUMB},f_png")
    )
    try:
        data = cloudinary.download(url, max_bytes=THUMB_MAX_BYTES)
        with Image.open(io.BytesIO(data)) as image:
            return image_to_thumbhash_b64(image)
    except (cloudinary.CloudinaryError, OSError) as exc:
        logger.info("Aperçu flou indisponible pour %s : %s", asset.id, exc)
        return ""


def process(asset: MediaAsset) -> TranscodeResult:
    """Variantes et aperçu flou (dimensions et durée relevées à la confirmation de l'envoi)."""
    return TranscodeResult(
        variants=variants(asset),
        width=asset.width,
        height=asset.height,
        duration_seconds=asset.duration_seconds,
        thumbhash=_thumbhash(asset),
    )
