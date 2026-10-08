from django.conf import settings
from django.db import models

from core.models import BaseModel


class Profile(BaseModel):
    """Profil tech public. Son id est celui de l'utilisateur, pour que la copie locale
    joigne directement `author_id` / `owner_id` sur la table `profiles`."""

    class AiStatus(models.TextChoices):
        IDLE = "idle", "Aucune"
        PENDING = "pending", "En cours"
        READY = "ready", "Prête"
        FAILED = "failed", "Échec"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    username = models.CharField(max_length=30, unique=True)
    display_name = models.CharField(max_length=80, blank=True)
    bio = models.TextField(max_length=600, blank=True)
    avatar_url = models.URLField(blank=True)
    stack = models.JSONField(default=list, blank=True)
    github_username = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=80, blank=True)
    website = models.URLField(blank=True)
    open_to_work = models.BooleanField(default=False)
    # Couleur d'accent du profil (bannière, avatar) parmi PROFILE_COLORS ; vide = attribuée
    # automatiquement à partir du pseudo, côté client.
    accent_color = models.CharField(max_length=12, blank=True)

    # Réputation (reputation.py) : recalculée à chaque vote, réponse acceptée ou sauvegarde.
    karma_score = models.IntegerField(default=0, db_index=True)
    # {"upvotes": n, "accepted_answers": n, "snippet_saves": n} : détail affiché sur le profil.
    karma_details = models.JSONField(default=dict, blank=True)
    # [{"code", "label", "description", "awarded_at"}] : badges automatiques.
    badges = models.JSONField(default=list, blank=True)

    # « Open to Work » détaillé : formes de collaboration recherchées (WORK_PREFERENCES),
    # tarif journalier indicatif et précisions libres.
    work_preferences = models.JSONField(default=list, blank=True)
    daily_rate = models.CharField(max_length=40, blank=True)
    availability_note = models.CharField(max_length=200, blank=True)
    # Contenus épinglés en tête du profil : [{"target_type", "target_id"}], 3 au plus.
    pinned = models.JSONField(default=list, blank=True)

    ai_bio_suggestion = models.TextField(blank=True)
    ai_bio_status = models.CharField(max_length=10, choices=AiStatus.choices, default=AiStatus.IDLE)

    def __str__(self):
        return self.username


PROFILE_COLORS = (
    "indigo",
    "blue",
    "cyan",
    "teal",
    "emerald",
    "lime",
    "amber",
    "terracotta",
    "rose",
    "violet",
    "slate",
)

WORK_PREFERENCES = {
    "cdi_remote": "CDI en télétravail",
    "cdi_onsite": "CDI sur site",
    "freelance": "Freelance",
    "mentorat": "Mentorat",
    "stage": "Stage / alternance",
}


class SkillEndorsement(BaseModel):
    """« +1 React Native par @dev_senegal » : un pair confirme une compétence de la stack."""

    endorsee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="endorsements_received"
    )
    endorser = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="endorsements_given"
    )
    skill = models.CharField(max_length=30)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["endorsee", "endorser", "skill"], name="profiles_one_endorsement"
            )
        ]
        indexes = [models.Index(fields=["endorsee", "skill"])]
