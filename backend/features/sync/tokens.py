"""Émission des jetons JWT PowerSync et exposition de la clé publique (JWKS).

PowerSync vérifie la signature via GET /api/sync/jwks/ ; `sub` devient request.user_id()
dans infra/powersync/sync-rules.yaml.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.conf import settings

logger = logging.getLogger(__name__)

AUDIENCE = "powersync"
TOKEN_LIFETIME = timedelta(minutes=30)


def _generate_dev_key(path: Path) -> bytes:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    path.write_bytes(pem)
    logger.warning("Clé PowerSync de développement générée dans %s", path)
    return pem


@lru_cache(maxsize=1)
def _private_key():
    pem = settings.POWERSYNC_JWT_PRIVATE_KEY.replace("\\n", "\n").encode()
    if not pem.strip():
        if not settings.POWERSYNC_ALLOW_DEV_KEY:
            raise RuntimeError("POWERSYNC_JWT_PRIVATE_KEY est obligatoire en production.")
        path = Path(settings.POWERSYNC_DEV_KEY_PATH)
        pem = path.read_bytes() if path.exists() else _generate_dev_key(path)
    return serialization.load_pem_private_key(pem, password=None)


def issue_token(user) -> tuple[str, datetime]:
    now = datetime.now(UTC)
    expires_at = now + TOKEN_LIFETIME
    token = jwt.encode(
        {"sub": str(user.id), "aud": AUDIENCE, "iat": now, "exp": expires_at},
        _private_key(),
        algorithm="RS256",
        headers={"kid": settings.POWERSYNC_JWT_KID},
    )
    return token, expires_at


def jwks() -> dict:
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(_private_key().public_key()))
    public_jwk.update({"kid": settings.POWERSYNC_JWT_KID, "alg": "RS256", "use": "sig"})
    return {"keys": [public_jwk]}
