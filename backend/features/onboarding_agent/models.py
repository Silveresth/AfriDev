from django.conf import settings
from django.db import models

from core.models import BaseModel


class OnboardingGuide(BaseModel):
    """Guide de démarrage d'un dépôt, rédigé par l'agent à partir du code réel."""

    class Status(models.TextChoices):
        PENDING = "pending", "En cours"
        READY = "ready", "Prêt"
        FAILED = "failed", "Échec"

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="onboarding_guides"
    )
    repo_url = models.URLField()
    # Projet AfriDev associé (features.projects), facultatif.
    project_id = models.UUIDField(null=True, blank=True)
    commit_sha = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    content = models.TextField(blank=True)
    error = models.CharField(max_length=300, blank=True)

    class Meta:
        indexes = [models.Index(fields=["repo_url", "-created_at"])]
