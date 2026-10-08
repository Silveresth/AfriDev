from django.conf import settings
from django.db import models

from core.models import BaseModel


class Project(BaseModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=100)
    description = models.TextField(max_length=3000, blank=True)
    repo_url = models.URLField(blank=True)
    # Technologies du projet (même forme que la colonne `tags` de la copie locale).
    tags = models.JSONField(default=list, blank=True)
    is_recruiting = models.BooleanField(default=True)

    # Données lues sur GitHub par la tâche de synchro (file « github »).
    stars = models.PositiveIntegerField(default=0)
    language = models.CharField(max_length=40, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error = models.CharField(max_length=300, blank=True)

    class Meta:
        indexes = [models.Index(fields=["-created_at"]), models.Index(fields=["owner"])]

    def __str__(self):
        return self.name


class Issue(BaseModel):
    """« Good first issue » importée du dépôt GitHub du projet."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="issues")
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=300)
    url = models.URLField()
    labels = models.JSONField(default=list, blank=True)
    is_open = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["project", "number"], name="projects_issue_unique")
        ]
        ordering = ["-number"]
