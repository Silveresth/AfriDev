"""Authentification de l'API : jetons d'accès personnels, puis JWT liés à une session.

Chargé par les réglages de DRF pendant l'import de rest_framework : les modules métier
(security, models) sont importés à l'usage pour éviter un import circulaire.
"""

from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

TOKEN_PREFIX = "afd_"


class PersonalAccessTokenAuthentication(BaseAuthentication):
    """`Authorization: Bearer afd_…` (ou `Token afd_…`). Un jeton en lecture seule refuse
    les écritures. Les autres valeurs passent à l'authentification JWT."""

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if len(parts) != 2 or parts[0].lower() not in (b"bearer", b"token"):
            return None
        raw = parts[1].decode(errors="ignore")
        if not raw.startswith(TOKEN_PREFIX):
            return None
        from . import security

        token = security.resolve_access_token(raw)
        if token is None:
            raise exceptions.AuthenticationFailed("Jeton d'accès invalide, expiré ou révoqué.")
        if token.read_only and request.method not in SAFE_METHODS:
            raise exceptions.PermissionDenied("Ce jeton d'accès est en lecture seule.")
        return token.user, token

    def authenticate_header(self, request):
        return "Bearer"


class SessionJWTAuthentication(JWTAuthentication):
    """JWT classique, refusé dès que la session (claim « sid ») a été révoquée."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        from . import security

        sid = token.get("sid")
        if sid and security.is_session_revoked(sid):
            raise InvalidToken("Session révoquée depuis un autre appareil.")
        return token


class NotPersonalAccessToken(BasePermission):
    """Sécurité du compte (jetons, sessions, 2FA, export) : jamais via un jeton d'API."""

    message = "Action impossible avec un jeton d'accès personnel."

    def has_permission(self, request, view):
        from .models import PersonalAccessToken

        return bool(
            request.user
            and request.user.is_authenticated
            and not isinstance(request.auth, PersonalAccessToken)
        )
