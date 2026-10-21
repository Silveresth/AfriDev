from django.conf import settings
from django.db import models

from core.models import BaseModel


class Reaction(BaseModel):
    """Vote ↑/↓ d'un membre sur une question, un snippet, un projet, une offre ou un commentaire
    (les posts ont le leur). Les types de commentaire sont ceux des signalements (moderation).

    Référence sans clé étrangère : un contenu supprimé laisse ses votes, sans effet.
    """

    class TargetType(models.TextChoices):
        QUESTION = "question", "Question"
        SNIPPET = "snippet", "Snippet"
        PROJECT = "project", "Projet"
        JOB = "job", "Offre d'emploi"
        COMMENT = "comment", "Commentaire de post"
        TARGET_COMMENT = "target_comment", "Commentaire (projet ou offre)"
        SNIPPET_COMMENT = "snippet_comment", "Commentaire de snippet"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reactions"
    )
    target_type = models.CharField(max_length=20, choices=TargetType.choices)
    target_id = models.UUIDField()
    value = models.SmallIntegerField()

    class Meta:
        indexes = [models.Index(fields=["target_type", "target_id"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "target_type", "target_id"], name="reactions_one_per_target"
            ),
            models.CheckConstraint(
                condition=models.Q(value__in=[-1, 1]), name="reactions_value_up_or_down"
            ),
        ]
