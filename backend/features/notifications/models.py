from django.conf import settings
from django.db import models

from core.models import BaseModel


class Notification(BaseModel):
    class Kind(models.TextChoices):
        NEW_COMMENT = "new_comment", "Nouveau commentaire"
        COMMENT_REPLY = "comment_reply", "Réponse à un commentaire"
        POST_LIKED = "post_liked", "Post aimé"
        NEW_ANSWER = "new_answer", "Nouvelle réponse"
        ANSWER_ACCEPTED = "answer_accepted", "Réponse acceptée"
        AI_ANSWER_READY = "ai_answer_ready", "Réponse IA prête"
        SNIPPET_FLAGGED = "snippet_flagged", "Snippet retiré"
        CONTENT_HIDDEN = "content_hidden", "Contenu masqué"
        GUIDE_READY = "guide_ready", "Guide d'onboarding prêt"
        APPLICATION_RECEIVED = "application_received", "Nouvelle candidature"
        APPLICATION_ANSWERED = "application_answered", "Réponse à une candidature"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=30, choices=Kind.choices)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=300, blank=True)
    # Cible du lien profond côté client, ex. {"route": "/question/<id>"}.
    data = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["recipient", "read_at", "-created_at"])]


class PushDevice(BaseModel):
    """Jeton Expo d'un appareil (mobile) pour les notifications push."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_devices"
    )
    token = models.CharField(max_length=200, unique=True)
    platform = models.CharField(max_length=10, blank=True)  # ios / android


class NotificationPreference(BaseModel):
    """Réglages > Notifications : types coupés, canaux push et e-mail."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    # Types (Notification.Kind) que le membre ne veut plus recevoir du tout.
    muted_kinds = models.JSONField(default=list, blank=True)
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
