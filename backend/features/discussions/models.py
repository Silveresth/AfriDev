from django.conf import settings
from django.db import models

from core.models import BaseModel


class Comment(BaseModel):
    # Référence vers features.feed (sans clé étrangère : features découplées).
    post_id = models.UUIDField(db_index=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies"
    )
    body = models.TextField(max_length=2000)

    class Meta:
        indexes = [models.Index(fields=["post_id", "created_at"])]


class ThreadSummary(BaseModel):
    """Résumé IA en 3 points d'un fil de commentaires, recalculé quand le fil grossit."""

    post_id = models.UUIDField(unique=True)
    points = models.JSONField(default=list)
    comment_count = models.PositiveIntegerField(default=0)
