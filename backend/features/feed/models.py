from django.conf import settings
from django.db import models

from core.models import BaseModel


class Post(BaseModel):
    class Kind(models.TextChoices):
        TEXT = "text", "Texte"
        IMAGE = "image", "Image"
        POLL = "poll", "Sondage"
        SHORT = "short", "Vidéo courte"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    # Titre façon Reddit ; vide pour les posts antérieurs (le corps sert alors de titre).
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(max_length=3000, blank=True)
    poll_options = models.JSONField(default=list, blank=True)
    # Référence vers features.media, sans clé étrangère pour garder les features découplées.
    media_id = models.UUIDField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    # Hub de rattachement (features.hubs), facultatif : référence sans clé étrangère.
    hub_id = models.UUIDField(null=True, blank=True, db_index=True)
    # Votes ↑/↓ : score = somme des votes, like_count = nombre de votes ↑.
    score = models.IntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    # Rangs précalculés (services.ranks) : tri « Populaires » / « Top » paginable par curseur.
    hot = models.FloatField(default=0)
    top = models.FloatField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["author", "-created_at"]),
            models.Index(fields=["-hot"]),
            models.Index(fields=["-top"]),
        ]

    def __str__(self):
        return f"{self.kind}:{(self.title or self.body)[:40]}"


class PollVote(BaseModel):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="votes")
    voter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    option = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["post", "voter"], name="feed_one_vote")]


class PostLike(BaseModel):
    """Vote d'un membre sur un post : +1 (↑) ou -1 (↓). Pas de ligne = pas de vote."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    value = models.SmallIntegerField(default=1)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="feed_one_like")]
