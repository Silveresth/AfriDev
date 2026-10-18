from django.conf import settings
from django.db import models
from django.db.models import F, Q

from core.models import BaseModel


class Conversation(BaseModel):
    """Discussion privée entre deux membres (messages directs, comme sur TikTok).

    La paire est rangée (user_low.id < user_high.id) : une seule conversation par duo.
    """

    user_low = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+"
    )
    user_high = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+"
    )
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_message_preview = models.CharField(max_length=140, blank=True)
    last_sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    low_read_at = models.DateTimeField(null=True, blank=True)
    high_read_at = models.DateTimeField(null=True, blank=True)
    # « Supprimer la discussion » (pour soi seul) : les messages antérieurs disparaissent du fil,
    # et la conversation de la boîte de réception jusqu'au prochain message.
    low_cleared_at = models.DateTimeField(null=True, blank=True)
    high_cleared_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user_low", "user_high"], name="messaging_one_per_pair"
            ),
            models.CheckConstraint(
                condition=Q(user_low__lt=F("user_high")), name="messaging_ordered_pair"
            ),
        ]

    def other_id(self, user_id):
        return self.user_high_id if self.user_low_id == user_id else self.user_low_id

    def read_at_for(self, user_id):
        return self.low_read_at if self.user_low_id == user_id else self.high_read_at

    def cleared_at_for(self, user_id):
        return self.low_cleared_at if self.user_low_id == user_id else self.high_cleared_at


class Message(BaseModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    body = models.TextField(max_length=2000, blank=True)
    # Photo, vidéo ou message vocal (features.media), facultatif ; référence sans clé étrangère.
    media_id = models.UUIDField(null=True, blank=True)
    # Réponse à un message précis (texte, photo, vidéo ou vocal), cité au-dessus de la bulle.
    reply_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    edited_at = models.DateTimeField(null=True, blank=True)
    # « Supprimer pour tout le monde » : contenu effacé, la bulle reste (« Message supprimé »).
    revoked_at = models.DateTimeField(null=True, blank=True)
    # « Supprimer pour moi » : masqué chez l'un des deux seulement.
    hidden_for_sender = models.BooleanField(default=False)
    hidden_for_recipient = models.BooleanField(default=False)
    # Arnaque probable (IA) : avertissement montré au destinataire seulement.
    risk_note = models.CharField(max_length=200, blank=True)

    class Meta:
        indexes = [models.Index(fields=["conversation", "-created_at"])]
