"""Web Push standard (navigateurs) : chiffrement RFC 8291 (aes128gcm) et authentification
VAPID RFC 8292, sans dépendance supplémentaire (cryptography + PyJWT).

Les clés VAPID se génèrent avec `manage.py generate_vapid_key` ; seule la clé privée est
configurée (WEBPUSH_VAPID_PRIVATE_KEY), la clé publique en est déduite.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from functools import lru_cache
from urllib.parse import urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

from .client import PushError

logger = logging.getLogger(__name__)

# Taille d'enregistrement annoncée (un seul enregistrement : les messages font < 4 Ko).
_RECORD_SIZE = 4096
# Les services de push acceptent 4 096 octets chiffrés : marge pour l'en-tête et le tag GCM.
MAX_PAYLOAD = 3800


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _public_bytes(key: ec.EllipticCurvePublicKey) -> bytes:
    return key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )


def _hmac(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def generate_private_key() -> str:
    """Nouvelle clé privée VAPID (scalaire P-256 de 32 octets, base64url)."""
    key = ec.generate_private_key(ec.SECP256R1())
    return b64url_encode(key.private_numbers().private_value.to_bytes(32, "big"))


@lru_cache(maxsize=4)
def _private_key(raw: str) -> ec.EllipticCurvePrivateKey:
    return ec.derive_private_key(int.from_bytes(b64url_decode(raw), "big"), ec.SECP256R1())


def is_configured() -> bool:
    return bool(settings.WEBPUSH_VAPID_PRIVATE_KEY)


def public_key() -> str | None:
    """Clé publique VAPID (applicationServerKey du navigateur), ou None si non configuré."""
    if not is_configured():
        return None
    return b64url_encode(
        _public_bytes(_private_key(settings.WEBPUSH_VAPID_PRIVATE_KEY).public_key())
    )


def encrypt(payload: bytes, *, p256dh: str, auth: str) -> bytes:
    """Corps chiffré aes128gcm (RFC 8291 §3.4) pour l'abonnement (p256dh, auth)."""
    ua_public = b64url_decode(p256dh)
    auth_secret = b64url_decode(auth)
    ua_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_public)

    as_private = ec.generate_private_key(ec.SECP256R1())
    as_public = _public_bytes(as_private.public_key())
    shared = as_private.exchange(ec.ECDH(), ua_key)

    # HKDF (extract + expand, une seule itération : 32 octets max).
    prk_key = _hmac(auth_secret, shared)
    ikm = _hmac(prk_key, b"WebPush: info\x00" + ua_public + as_public + b"\x01")
    salt = os.urandom(16)
    prk = _hmac(salt, ikm)
    cek = _hmac(prk, b"Content-Encoding: aes128gcm\x00\x01")[:16]
    nonce = _hmac(prk, b"Content-Encoding: nonce\x00\x01")[:12]

    # Délimiteur 0x02 : dernier (et unique) enregistrement.
    ciphertext = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    header = salt + _RECORD_SIZE.to_bytes(4, "big") + bytes([len(as_public)]) + as_public
    return header + ciphertext


def _vapid_header(endpoint: str) -> str:
    parts = urlsplit(endpoint)
    claims = {
        "aud": f"{parts.scheme}://{parts.netloc}",
        "exp": int(time.time()) + 12 * 3600,
        "sub": settings.WEBPUSH_VAPID_SUBJECT,
    }
    token = jwt.encode(claims, _private_key(settings.WEBPUSH_VAPID_PRIVATE_KEY), algorithm="ES256")
    return f"vapid t={token}, k={public_key()}"


def is_allowed_endpoint(endpoint: str) -> bool:
    """Seuls les services de push des navigateurs sont acceptés : l'URL est appelée par le
    serveur, un endpoint arbitraire permettrait de lui faire contacter un hôte interne (SSRF)."""
    parts = urlsplit(endpoint)
    host = (parts.hostname or "").lower()
    return parts.scheme == "https" and any(
        host == allowed or host.endswith("." + allowed)
        for allowed in settings.WEBPUSH_ALLOWED_HOSTS
    )


def send_webpush(*, subscriptions: list[dict], message: dict, ttl: int = 86400) -> list[str]:
    """Envoie `message` (JSON) à chaque abonnement {endpoint, p256dh, auth} ; renvoie les
    endpoints expirés (404/410) à supprimer. Lève PushError sur une panne passagère."""
    if not is_configured() or not subscriptions:
        return []
    body = json.dumps(message, ensure_ascii=False).encode()
    if len(body) > MAX_PAYLOAD:
        message = {**message, "body": message.get("body", "")[:200]}
        body = json.dumps(message, ensure_ascii=False).encode()

    expired: list[str] = []
    transient: list[str] = []
    with httpx.Client(timeout=10) as client:
        for subscription in subscriptions:
            endpoint = subscription["endpoint"]
            if not is_allowed_endpoint(endpoint):
                expired.append(endpoint)
                continue
            try:
                response = client.post(
                    endpoint,
                    content=encrypt(body, p256dh=subscription["p256dh"], auth=subscription["auth"]),
                    headers={
                        "Authorization": _vapid_header(endpoint),
                        "Content-Encoding": "aes128gcm",
                        "Content-Type": "application/octet-stream",
                        "TTL": str(ttl),
                        "Urgency": "normal",
                    },
                )
            except (httpx.HTTPError, ValueError) as exc:
                transient.append(f"{endpoint[:60]}: {exc}")
                continue
            if response.status_code in (404, 410):
                expired.append(endpoint)
            elif response.status_code == 429 or response.status_code >= 500:
                transient.append(f"{endpoint[:60]}: HTTP {response.status_code}")
            elif response.status_code >= 400:
                # Clés invalides ou requête refusée : l'abonnement ne fonctionnera jamais.
                logger.warning(
                    "Web Push refusé (%s) : %s", response.status_code, response.text[:200]
                )
                expired.append(endpoint)
    if transient and len(transient) == len(subscriptions):
        raise PushError("; ".join(transient))
    if transient:
        logger.warning("Web Push partiellement échoué : %s", "; ".join(transient))
    return expired
