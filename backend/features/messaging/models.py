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


class Message(BaseModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    body = models.TextField(max_length=2000)

    class Meta:
        indexes = [models.Index(fields=["conversation", "-created_at"])]
