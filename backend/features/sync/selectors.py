"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import QuerySet

from .models import SyncRejection


def list_pending_rejections(*, user) -> QuerySet[SyncRejection]:
    return SyncRejection.objects.filter(user=user, acknowledged_at__isnull=True).order_by(
        "-created_at"
    )


def rejection_stats(*, since) -> dict:
    rejections = SyncRejection.objects.alive()
    return {
        "new": rejections.filter(created_at__gte=since).count(),
        "unacknowledged": rejections.filter(acknowledged_at__isnull=True).count(),
    }
