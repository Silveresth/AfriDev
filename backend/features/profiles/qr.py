"""Génération du QR code qui pointe vers le profil public /u/<username>."""

import io

import segno
from django.conf import settings


def profile_url(username: str) -> str:
    return f"{settings.PUBLIC_WEB_URL.rstrip('/')}/u/{username}"


def profile_qr_svg(username: str) -> bytes:
    """SVG léger (quelques Ko), net à toute taille ; correction d'erreur « M »."""
    buffer = io.BytesIO()
    segno.make(profile_url(username), error="m").save(buffer, kind="svg", scale=8, border=2)
    return buffer.getvalue()
