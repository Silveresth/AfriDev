"""Session du site web : jeton de renouvellement dans un cookie httpOnly.

Le site envoie l'en-tête « X-Auth-Mode: cookie » : le jeton de renouvellement (30 jours) part
alors dans un cookie que JavaScript ne peut pas lire (httpOnly, Secure, SameSite=Strict, limité
à /api/accounts/), et le corps ne contient que le jeton d'accès (30 min, gardé en mémoire).
Une faille XSS ne peut donc plus emporter la session. L'appli mobile, sans cet en-tête, reçoit
les deux jetons comme avant (gardés chiffrés dans le trousseau du téléphone).
"""

from django.conf import settings
from rest_framework_simplejwt.settings import api_settings as jwt_settings

from core.exceptions import PermissionDeniedError

from . import oauth

REFRESH_COOKIE = "afd_refresh"
COOKIE_PATH = "/api/accounts/"
MODE_HEADER = "X-Auth-Mode"


def wants_cookie(request) -> bool:
    return request.headers.get(MODE_HEADER, "").strip().lower() == "cookie"


def cookie_refresh(request) -> str:
    return request.COOKIES.get(REFRESH_COOKIE, "")


def ensure_trusted_origin(request) -> None:
    """Le cookie part tout seul avec la requête : on vérifie aussi qu'elle vient du site
    (SameSite=Strict le garantit déjà dans les navigateurs récents ; ceci couvre les autres)."""
    origin = request.headers.get("Origin", "").rstrip("/")
    if origin and origin not in oauth.web_origins():
        raise PermissionDeniedError("Origine non autorisée.", code="untrusted_origin")


def store(response, refresh: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        path=COOKIE_PATH,
        secure=settings.SESSION_COOKIE_SECURE,
        httponly=True,
        samesite="Strict",
    )


def clear(response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, samesite="Strict")


def present(request, response, tokens: dict | None) -> None:
    """Mode cookie : déplace le jeton de renouvellement du corps vers le cookie."""
    if not tokens or not wants_cookie(request) or not tokens.get("refresh"):
        return
    store(response, tokens["refresh"])
    tokens["refresh"] = ""
