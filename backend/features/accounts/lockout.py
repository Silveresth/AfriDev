"""Verrouillage temporaire après des échecs répétés (mot de passe, code de double authentification).

La limite par adresse IP (DRF) ne suffit pas : une attaque répartie sur de nombreuses adresses
peut viser un seul compte. Les échecs sont donc aussi comptés par compte visé, dans le cache.
"""

import hashlib

from django.core.cache import cache

from core.exceptions import TooManyAttemptsError

MAX_FAILURES = 10
WINDOW_SECONDS = 15 * 60


def _key(scope: str, subject: str) -> str:
    digest = hashlib.sha256(subject.strip().lower().encode()).hexdigest()[:32]
    return f"lockout:{scope}:{digest}"


def ensure_allowed(scope: str, subject: str) -> None:
    if (cache.get(_key(scope, subject)) or 0) >= MAX_FAILURES:
        raise TooManyAttemptsError(
            "Trop de tentatives sur ce compte. Réessayez dans 15 minutes "
            "ou réinitialisez votre mot de passe."
        )


def record_failure(scope: str, subject: str) -> None:
    key = _key(scope, subject)
    # add() crée le compteur avec sa durée de vie ; incr() garde l'expiration d'origine.
    if not cache.add(key, 1, WINDOW_SECONDS):
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, WINDOW_SECONDS)


def reset(scope: str, subject: str) -> None:
    cache.delete(_key(scope, subject))
