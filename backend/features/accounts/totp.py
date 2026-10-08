"""Codes à usage unique basés sur le temps (TOTP, RFC 6238), compatibles Google Authenticator,
Aegis, 2FAS… Sans dépendance : HMAC-SHA1, pas de 30 s, 6 chiffres."""

import base64
import hashlib
import hmac
import io
import secrets
import struct
import time
from urllib.parse import quote, urlencode

import segno

STEP = 30
DIGITS = 6
ISSUER = "AfriDev Exchange"


def new_secret() -> str:
    """Secret base32 de 160 bits (sans « = » final, comme l'attendent les applications)."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _code(secret: str, step: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 10**DIGITS:0{DIGITS}d}"


def current_step(at: float | None = None) -> int:
    return int((time.time() if at is None else at) // STEP)


def matching_step(
    secret: str, code: str, *, window: int = 1, at: float | None = None
) -> int | None:
    """Pas de temps du code (±30 s de tolérance pour l'horloge du téléphone), sinon None."""
    code = (code or "").replace(" ", "").strip()
    if not (secret and code.isdigit() and len(code) == DIGITS):
        return None
    now = current_step(at)
    for step in range(now - window, now + window + 1):
        if hmac.compare_digest(_code(secret, step), code):
            return step
    return None


def provisioning_uri(secret: str, account: str) -> str:
    label = quote(f"{ISSUER}:{account}")
    query = urlencode({"secret": secret, "issuer": ISSUER, "digits": DIGITS, "period": STEP})
    return f"otpauth://totp/{label}?{query}"


def qr_svg(uri: str) -> str:
    buffer = io.BytesIO()
    segno.make(uri, error="m").save(buffer, kind="svg", scale=5, border=2, xmldecl=False)
    return buffer.getvalue().decode()
