"""Résolution des conflits des écritures hors ligne.

- Les opérations sont rejouées dans l'ordre de la file de l'appareil : la dernière écriture
  reçue gagne (last-write-wins), sauf règles métier portées par les services des features
  (seul l'auteur modifie, le Security Guard bloque les secrets…).
- Rejouer une création déjà reçue est sans effet (UUID générés par le client).
- Une erreur métier est définitive : l'opération est écartée et tracée (SyncRejection).
- Toute autre erreur est temporaire : le lot échoue et PowerSync le renverra plus tard.
"""

from django.core.exceptions import ValidationError as DjangoValidationError

from core.exceptions import DomainError

PERMANENT_ERRORS = (DomainError, DjangoValidationError, ValueError, KeyError, TypeError)


def is_permanent(error: Exception) -> bool:
    return isinstance(error, PERMANENT_ERRORS)


def describe(error: Exception) -> tuple[str, str]:
    if isinstance(error, DomainError):
        return error.code, error.message
    if isinstance(error, DjangoValidationError):
        return "invalid", "; ".join(error.messages)[:300]
    return "invalid", str(error)[:300] or error.__class__.__name__
