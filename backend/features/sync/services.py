"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

import logging

from django.db import transaction
from django.utils import timezone

from core.exceptions import NotFoundError

from . import conflicts
from .handlers import WRITERS
from .models import SyncRejection

logger = logging.getLogger(__name__)

OPS = {"PUT", "PATCH", "DELETE"}


def apply_operations(*, user, operations: list[dict]) -> dict:
    """Rejoue une transaction de la file locale. Chaque opération a son propre point de
    sauvegarde : une opération refusée n'annule pas les autres."""
    applied, rejected = 0, []
    for operation in operations:
        op = str(operation.get("op", "")).upper()
        table = operation.get("type") or operation.get("table") or ""
        record_id = operation.get("id")
        data = operation.get("data") or {}

        try:
            writer = WRITERS.get(table)
            if writer is None:
                raise ValueError(f"Table non synchronisable : {table or '?'}.")
            if op not in OPS or not record_id:
                raise ValueError("Opération invalide.")
            with transaction.atomic():
                writer(user=user, op=op, record_id=record_id, data=data)
            applied += 1
        except Exception as error:
            if op == "DELETE" and isinstance(error, NotFoundError):
                applied += 1  # déjà supprimé (lot rejoué après une coupure) : rien à faire
                continue
            if not conflicts.is_permanent(error):
                raise  # erreur temporaire : PowerSync renverra le lot
            code, message = conflicts.describe(error)
            rejection = SyncRejection.objects.create(
                user=user,
                op_id=operation.get("op_id"),
                table=table[:40],
                record_id=str(record_id)[:64],
                op=op[:10],
                data=data if isinstance(data, dict) else {},
                code=code[:40],
                message=message[:300],
            )
            logger.info("sync_rejected user=%s table=%s code=%s", user.id, table, code)
            rejected.append(
                {
                    "id": str(rejection.id),
                    "op_id": rejection.op_id,
                    "table": table,
                    "record_id": rejection.record_id,
                    "code": code,
                    "message": message,
                }
            )
    return {"applied": applied, "rejected": rejected}


def acknowledge_rejections(*, user, ids: list) -> int:
    return SyncRejection.objects.filter(user=user, id__in=ids, acknowledged_at=None).update(
        acknowledged_at=timezone.now()
    )
