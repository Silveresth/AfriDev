from django.conf import settings
from django.db import models

from core.models import BaseModel


class ProjectApplication(BaseModel):
    """Candidature d'un développeur pour contribuer à un projet."""

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptée"
        DECLINED = "declined", "Déclinée"

    # Référence vers features.projects (sans clé étrangère : features découplées).
    project_id = models.UUIDField(db_index=True)
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications"
    )
    message = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project_id", "candidate"], name="matchmaking_one_application"
            )
        ]
