"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, Q

from .models import Reaction


def summaries(*, target_type: str, target_ids, viewer_id=None) -> dict:
    """{target_id: {"score", "up", "down", "viewer_vote"}} en deux requêtes, pour tous les ids."""
    ids = list(target_ids)
    result = {pk: {"score": 0, "up": 0, "down": 0, "viewer_vote": 0} for pk in ids}
    if not ids:
        return result
    rows = (
        Reaction.objects.filter(target_type=target_type, target_id__in=ids)
        .values("target_id")
        .annotate(up=Count("id", filter=Q(value=1)), down=Count("id", filter=Q(value=-1)))
    )
    for row in rows:
        entry = result.setdefault(row["target_id"], {"viewer_vote": 0})
        entry.update(up=row["up"], down=row["down"], score=row["up"] - row["down"])
    if viewer_id:
        mine = Reaction.objects.filter(
            target_type=target_type, target_id__in=ids, user_id=viewer_id
        ).values_list("target_id", "value")
        for target_id, value in mine:
            result[target_id]["viewer_vote"] = value
    return result


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD)."""
    return {
        "reactions": [
            {"type": r.target_type, "id": r.target_id, "value": r.value, "at": r.created_at}
            for r in Reaction.objects.filter(user_id=user_id)
        ]
    }
