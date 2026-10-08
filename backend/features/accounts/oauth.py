"""Connexion GitHub / GitLab / Google : échange du code OAuth contre une identité vérifiée.

L'appli mobile passe par un « rebond » serveur : le fournisseur renvoie vers l'API
(/oauth/<provider>/callback/), qui redirige vers l'appli avec le code. Ainsi une seule URL de
retour https/http est déclarée chez GitHub ou Google, quel que soit l'appareil.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.core import signing

from core.exceptions import DomainError
from integrations import github, google
from integrations.github import OAuthIdentity


class OAuthError(DomainError):
    code = "oauth_failed"


_EXCHANGERS = {
    "github": github.exchange_github_code,
    "gitlab": github.exchange_gitlab_code,
    "google": google.exchange_google_code,
}

# Schémas autorisés pour le retour vers l'appli (Expo Go, development build, appli publiée).
APP_SCHEMES = ("exp://", "exps://", "afridev://")
STATE_SALT = "afridev.oauth.mobile"
STATE_MAX_AGE = 10 * 60


def fetch_identity(provider: str, code: str, redirect_uri: str | None = None) -> OAuthIdentity:
    exchanger = _EXCHANGERS.get(provider)
    if exchanger is None:
        raise OAuthError(f"Fournisseur inconnu : {provider}.")
    try:
        return exchanger(code, redirect_uri)
    except (github.GitHubError, google.GoogleError) as exc:
        raise OAuthError(str(exc)) from exc


def configured_providers() -> list[str]:
    """Fournisseurs dont l'application OAuth est déclarée côté serveur."""
    pairs = {
        "github": (settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET),
        "google": (settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET),
        "gitlab": (settings.GITLAB_CLIENT_ID, settings.GITLAB_CLIENT_SECRET),
    }
    return [name for name, (client_id, secret) in pairs.items() if client_id and secret]


def authorize_url(provider: str, *, callback_url: str, return_to: str) -> str:
    """URL du fournisseur ; `state` signé transporte l'adresse de retour vers l'appli."""
    if provider not in configured_providers():
        raise OAuthError(f"La connexion {provider} n'est pas configurée sur le serveur.")
    if not return_to.startswith(APP_SCHEMES):
        raise OAuthError("Adresse de retour non autorisée.")
    state = signing.dumps({"p": provider, "r": return_to}, salt=STATE_SALT)
    if provider == "github":
        query = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": callback_url,
            "scope": "read:user user:email",
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{urlencode(query)}"
    if provider == "google":
        query = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": callback_url,
            "response_type": "code",
            "scope": "openid email profile",
            "prompt": "select_account",
            "state": state,
        }
        return f"{google.AUTHORIZE_URL}?{urlencode(query)}"
    query = {
        "client_id": settings.GITLAB_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "read_user",
        "state": state,
    }
    return f"{settings.GITLAB_URL.rstrip('/')}/oauth/authorize?{urlencode(query)}"


def app_return_url(provider: str, *, state: str, params: dict[str, str]) -> str:
    """Vérifie le `state` (signature + 10 min) et construit le lien de retour vers l'appli."""
    try:
        data = signing.loads(state, salt=STATE_SALT, max_age=STATE_MAX_AGE)
    except signing.BadSignature as exc:
        raise OAuthError("Session de connexion expirée, recommencez.") from exc
    if data.get("p") != provider or not str(data.get("r", "")).startswith(APP_SCHEMES):
        raise OAuthError("Session de connexion invalide.")
    separator = "&" if "?" in data["r"] else "?"
    return f"{data['r']}{separator}{urlencode({'provider': provider, **params})}"
