"""Format d'erreur unique pour le web et le mobile :
{"error": {"code": "...", "message": "...", "details": {...}}}
"""

from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


class DomainError(Exception):
    """Erreur métier levée par les services, traduite en 400 par l'API."""

    code = "domain_error"
    status_code = 400

    def __init__(self, message: str, *, code: str | None = None, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code or self.code
        self.details = details or {}


class NotFoundError(DomainError):
    code = "not_found"
    status_code = 404


class PermissionDeniedError(DomainError):
    code = "permission_denied"
    status_code = 403


class ConflictError(DomainError):
    code = "conflict"
    status_code = 409


def api_exception_handler(exc, context):
    from rest_framework.response import Response

    if isinstance(exc, DomainError):
        return Response(
            {"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
            status=exc.status_code,
        )

    response = exception_handler(exc, context)
    if response is None:
        return None

    code = getattr(exc, "default_code", "error")
    if isinstance(exc, ValidationError):
        message = "Données invalides."
    else:
        message = str(getattr(exc, "detail", exc))
    details = response.data if isinstance(response.data, dict) else {"errors": response.data}
    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
