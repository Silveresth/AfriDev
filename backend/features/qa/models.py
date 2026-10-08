from django.conf import settings
from django.db import models

from core.models import BaseModel


class Question(BaseModel):
    class AiStatus(models.TextChoices):
        PENDING = "pending", "En cours"
        READY = "ready", "Prête"
        FAILED = "failed", "Échec"
        DISABLED = "disabled", "Désactivée"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="questions"
    )
    title = models.CharField(max_length=200)
    body = models.TextField(max_length=10000)
    tags = models.JSONField(default=list, blank=True)
    # Question posée à la voix : message vocal d'origine (features.media).
    audio_media_id = models.UUIDField(null=True, blank=True)
    # Hub de rattachement (features.hubs), facultatif.
    hub_id = models.UUIDField(null=True, blank=True, db_index=True)

    ai_answer = models.TextField(blank=True)
    ai_answer_status = models.CharField(
        max_length=10, choices=AiStatus.choices, default=AiStatus.PENDING
    )
    # [{"source_type", "source_id", "title", "url"}] : sources citées par la réponse IA.
    ai_answer_sources = models.JSONField(default=list, blank=True)

    is_resolved = models.BooleanField(default=False)
    answer_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["-created_at"]), models.Index(fields=["is_resolved"])]

    def __str__(self):
        return self.title


class Answer(BaseModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="answers"
    )
    body = models.TextField(max_length=10000)
    is_accepted = models.BooleanField(default=False)
    score = models.IntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["question", "created_at"])]


class AnswerVote(BaseModel):
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name="votes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    value = models.SmallIntegerField()  # +1 ou -1

    class Meta:
        constraints = [models.UniqueConstraint(fields=["answer", "user"], name="qa_one_vote")]
