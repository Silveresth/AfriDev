"""Cloudinary : envoi direct signé, informations d'un fichier, URLs de transformation, suppression.

Le fichier part du client vers Cloudinary sans transiter par le VPS (formulaire signé ici) ;
Cloudinary produit ensuite les variantes à la volée (taille, WebP/AVIF, HLS, affiche, audio),
ce qui évite tout transcodage ffmpeg sur le serveur.

Configuration : CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>, ou les trois
variables CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
"""

import hashlib
import time
from dataclasses import dataclass
from urllib.parse import quote

import httpx
from django.conf import settings

API_BASE = "https://api.cloudinary.com/v1_1"
DELIVERY_BASE = "https://res.cloudinary.com"
# Médias de l'appli → type de ressource Cloudinary (l'audio est traité comme une vidéo).
RESOURCE_TYPES = {"image": "image", "video": "video", "audio": "video"}


class CloudinaryError(Exception):
    pass


@dataclass(frozen=True)
class SignedUpload:
    """Formulaire multipart que le client envoie tel quel, avec le fichier dans `file_field`."""

    url: str
    fields: dict
    file_field: str = "file"


@dataclass(frozen=True)
class ResourceInfo:
    bytes: int
    format: str
    secure_url: str
    width: int | None
    height: int | None
    duration: float | None


def is_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def sign(params: dict) -> str:
    """Signature Cloudinary : SHA-1 des paramètres triés « clé=valeur » joints par « & », suivis
    du secret (file, api_key, resource_type et cloud_name ne sont pas signés)."""
    excluded = {"file", "api_key", "resource_type", "cloud_name", "signature"}
    payload = "&".join(
        f"{key}={params[key]}"
        for key in sorted(params)
        if key not in excluded and params[key] != ""
    )
    return hashlib.sha1(f"{payload}{settings.CLOUDINARY_API_SECRET}".encode()).hexdigest()


def signed_upload(*, public_id: str, resource_type: str, eager: str = "") -> SignedUpload:
    """Formulaire d'envoi direct, valable une heure (contrôle d'horodatage de Cloudinary).
    Le `public_id` est imposé et signé : le client ne peut pas écrire ailleurs."""
    params = {"public_id": public_id, "timestamp": str(int(time.time())), "overwrite": "false"}
    if eager:
        params["eager"] = eager
        params["eager_async"] = "true"
    fields = {**params, "api_key": settings.CLOUDINARY_API_KEY, "signature": sign(params)}
    return SignedUpload(
        url=f"{API_BASE}/{settings.CLOUDINARY_CLOUD_NAME}/{resource_type}/upload", fields=fields
    )


def _auth() -> tuple[str, str]:
    return settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET


def resource(*, public_id: str, resource_type: str) -> ResourceInfo | None:
    """Fichier réellement reçu (API d'administration), ou None s'il n'existe pas."""
    path = quote(public_id, safe="/")
    url = f"{API_BASE}/{settings.CLOUDINARY_CLOUD_NAME}/resources/{resource_type}/upload/{path}"
    try:
        response = httpx.get(url, auth=_auth(), timeout=15)
    except httpx.HTTPError as exc:
        raise CloudinaryError(str(exc)) from exc
    if response.status_code == 404:
        return None
    if response.status_code >= 400:
        raise CloudinaryError(f"Cloudinary {response.status_code} : {response.text[:200]}")
    data = response.json()
    return ResourceInfo(
        bytes=int(data.get("bytes") or 0),
        format=data.get("format") or "",
        secure_url=data.get("secure_url") or "",
        width=data.get("width"),
        height=data.get("height"),
        duration=data.get("duration"),
    )


def destroy(*, public_id: str, resource_type: str) -> None:
    """Supprime le fichier et ses variantes (cache CDN invalidé). Idempotent."""
    params = {"public_id": public_id, "timestamp": str(int(time.time())), "invalidate": "true"}
    data = {**params, "api_key": settings.CLOUDINARY_API_KEY, "signature": sign(params)}
    try:
        httpx.post(
            f"{API_BASE}/{settings.CLOUDINARY_CLOUD_NAME}/{resource_type}/destroy",
            data=data,
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise CloudinaryError(str(exc)) from exc


def delivery_url(
    *, public_id: str, resource_type: str, transformation: str = "", fmt: str = ""
) -> str:
    """URL publique (CDN Cloudinary), avec une transformation appliquée à la volée."""
    parts = [DELIVERY_BASE, settings.CLOUDINARY_CLOUD_NAME, resource_type, "upload"]
    if transformation:
        parts.append(transformation)
    path = "/".join(parts) + "/" + quote(public_id, safe="/")
    return f"{path}.{fmt}" if fmt else path


def download(url: str, *, max_bytes: int) -> bytes:
    """Télécharge une variante (petite vignette, message vocal), en refusant tout fichier plus
    lourd que prévu."""
    try:
        with httpx.stream("GET", url, timeout=30, follow_redirects=True) as response:
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    raise CloudinaryError("Fichier plus lourd que prévu.")
                chunks.append(chunk)
    except httpx.HTTPError as exc:
        raise CloudinaryError(str(exc)) from exc
    return b"".join(chunks)
