"""Agrégats génériques pour les tableaux de bord (aucune connaissance du métier)."""

from django.db.models import Count, QuerySet
from django.db.models.functions import TruncDate


def count_per_day(queryset: QuerySet, *, since, field: str = "created_at") -> dict[str, int]:
    """{"2026-10-01": 12, ...} : nombre de lignes créées chaque jour depuis `since`."""
    rows = (
        queryset.filter(**{f"{field}__gte": since})
        .annotate(day=TruncDate(field))
        .values("day")
        .annotate(total=Count("pk"))
        .order_by()
    )
    return {row["day"].isoformat(): row["total"] for row in rows if row["day"]}


def merge_daily(*series: dict[str, int]) -> dict[str, int]:
    """Additionne plusieurs séries journalières."""
    merged: dict[str, int] = {}
    for serie in series:
        for day, value in serie.items():
            merged[day] = merged.get(day, 0) + value
    return merged
