"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from .models import Translation


def get_translation(*, translation_id) -> Translation | None:
    return Translation.objects.filter(id=translation_id).first()


def translation_stats(*, since) -> dict:
    return {"new": Translation.objects.filter(created_at__gte=since).count()}
