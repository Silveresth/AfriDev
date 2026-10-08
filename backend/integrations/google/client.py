"""Connexion Google (OpenID Connect) : échange du code contre une identité vérifiée."""

import httpx
from django.conf import settings

from integrations.github import OAuthIdentity

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleError(Exception):
    pass


def exchange_google_code(code: str, redirect_uri: str | None = None) -> OAuthIdentity:
    try:
        response = httpx.post(
            TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri or settings.OAUTH_REDIRECT_URI,
            },
            timeout=20,
        )
        token = response.json().get("access_token")
        if not token:
            raise GoogleError("Code Google invalide ou expiré.")
        user = httpx.get(
            USERINFO_URL, headers={"Authorization": f"Bearer {token}"}, timeout=20
        ).json()
    except (httpx.HTTPError, ValueError) as exc:
        raise GoogleError(str(exc)) from exc

    # Un e-mail non vérifié ne doit jamais servir à rattacher un compte existant.
    email = user.get("email", "") if user.get("email_verified") else ""
    return OAuthIdentity(
        provider="google",
        uid=str(user["sub"]),
        username=(user.get("email", "") or user.get("name", "") or "dev").split("@")[0],
        email=email,
        name=user.get("name") or "",
        avatar_url=user.get("picture") or "",
        access_token=token,
    )
