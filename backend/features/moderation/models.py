from django.conf import settings
from django.db import models

from core.models import BaseModel


class Report(BaseModel):
    """Signalement d'un contenu, par un membre ou par l'IA (reporter vide)."""

    class TargetType(models.TextChoices):
        POST = "post", "Post"
        COMMENT = "comment", "Commentaire"
        QUESTION = "question", "Question"
        ANSWER = "answer", "Réponse"

    class Reason(models.TextChoices):
        SPAM = "spam", "Spam ou publicité"
        ABUSE = "abuse", "Harcèlement ou propos haineux"
        SCAM = "scam", "Arnaque"
        SECRET = "secret", "Donnée sensible exposée"
        OFF_TOPIC = "off_topic", "Hors sujet"
        OTHER = "other", "Autre"

    class Status(models.TextChoices):
        OPEN = "open", "À traiter"
        HIDDEN = "hidden", "Contenu masqué"
        DISMISSED = "dismissed", "Rejeté"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
    )
    target_type = models.CharField(max_length=20, choices=TargetType.choices)
    target_id = models.UUIDField()
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    # {"violates": bool, "category": str, "confidence": float, "explanation": str}
    ai_verdict = models.JSONField(default=dict, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["status"]),
        ]
