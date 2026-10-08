from django.conf import settings
from django.db import models

from core.models import BaseModel


class Snippet(BaseModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="snippets"
    )
    title = models.CharField(max_length=120)
    language = models.CharField(max_length=40)
    content = models.TextField(max_length=50000)
    # Liste JSON : même forme que la colonne `tags` de la copie locale (PowerSync).
    tags = models.JSONField(default=list, blank=True)
    is_public = models.BooleanField(default=False)
    # Hub où le snippet est partagé une fois public (features.hubs), facultatif.
    hub_id = models.UUIDField(null=True, blank=True, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    # Étage 2 du Security Guard : {"risky": bool, "reasons": [...], "checked_at": iso}
    ai_review = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["owner", "-created_at"]),
            models.Index(fields=["is_public", "-published_at"]),
        ]

    def __str__(self):
        return self.title


class SnippetVersion(BaseModel):
    snippet = models.ForeignKey(Snippet, on_delete=models.CASCADE, related_name="versions")
    content = models.TextField()
    number = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["snippet", "number"], name="snippets_version_unique")
        ]
        ordering = ["-number"]
