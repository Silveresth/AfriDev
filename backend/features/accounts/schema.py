"""Description OpenAPI des authentifications maison (drf-spectacular)."""

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionJWTScheme(SimpleJWTScheme):
    target_class = "features.accounts.authentication.SessionJWTAuthentication"
    name = "jwtAuth"


class PersonalAccessTokenScheme(OpenApiAuthenticationExtension):
    target_class = "features.accounts.authentication.PersonalAccessTokenAuthentication"
    name = "personalAccessToken"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "description": "Jeton d'accès personnel « afd_… » (Réglages > Confidentialité).",
        }
