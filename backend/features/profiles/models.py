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
    # Photo de couverture, envoyée directement vers le stockage objet (R2).
    banner_url = models.URLField(blank=True)
    # {"github": url, "tiktok": url, …} : réseaux de SOCIAL_NETWORKS uniquement.
    social_links = models.JSONField(default=dict, blank=True)
    stack = models.JSONField(default=list, blank=True)
    github_username = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=80, blank=True)
    website = models.URLField(blank=True)
    open_to_work = models.BooleanField(default=False)
    # Couleur d'accent du profil (bannière, avatar) parmi PROFILE_COLORS ; vide = attribuée
    # automatiquement à partir du pseudo, côté client.
    accent_color = models.CharField(max_length=12, blank=True)

    # Réputation « Craft » (reputation.py) : recalculée à chaque vote, réponse acceptée ou favori.
    # `karma_score` (nom historique, conservé pour la compatibilité) = Craft Score global.
    karma_score = models.IntegerField(default=0, db_index=True)
    # Jauges Entraide (Q&A) et Création (posts, snippets) ; indexées pour le classement Top 5 %.
    craft_help = models.IntegerField(default=0, db_index=True)
    craft_creation = models.IntegerField(default=0, db_index=True)
    # Compteurs bruts : {"answer_upvotes", "accepted_answers", "post_upvotes", "snippet_saves",
    # "project_stars", "upvotes" (cumul, ancien format)}.
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

    # Préférences d'accueil (preferences.py) : alimentent le fil personnalisé.
    experience_level = models.CharField(max_length=12, blank=True)
    # Codes de preferences.GOALS (apprendre, aider, trouver une mission…).
    goals = models.JSONField(default=list, blank=True)
    # Tags suivis (thématiques + technologies à apprendre + stack), normalisés.
    interests = models.JSONField(default=list, blank=True)
    # Accueil terminé (ou passé) : l'écran ne se réaffiche sur aucun appareil.
    onboarded_at = models.DateTimeField(null=True, blank=True)

    # Compteurs dénormalisés (tenus à jour par services.follow / unfollow) : un profil
    # s'affiche sans COUNT(*) sur la table des abonnements.
    followers_count = models.PositiveIntegerField(default=0)
    following_count = models.PositiveIntegerField(default=0)

    ai_bio_suggestion = models.TextField(blank=True)
    ai_bio_status = models.CharField(max_length=10, choices=AiStatus.choices, default=AiStatus.IDLE)

    def __str__(self):
        return self.username

    @property
    def craft_score(self) -> int:
        """Alias lisible de la colonne historique `karma_score`."""
        return self.karma_score


# Réseau -> domaines acceptés (vide : tout domaine en https, ex. portfolio).
SOCIAL_NETWORKS = {
    "github": ("github.com",),
    "gitlab": ("gitlab.com",),
    "linkedin": ("linkedin.com",),
    "twitter": ("x.com", "twitter.com"),
    "tiktok": ("tiktok.com",),
    "instagram": ("instagram.com",),
    "youtube": ("youtube.com", "youtu.be"),
    "facebook": ("facebook.com", "fb.com"),
    "dev": ("dev.to",),
    "medium": ("medium.com",),
    "portfolio": (),
}


class UserFollow(BaseModel):
    """« @a suit @b ». Supprimé (pas de suppression douce) quand on se désabonne."""

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following_relations"
    )
    followed = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="follower_relations"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "followed"], name="profiles_one_follow"),
            models.CheckConstraint(
                condition=~models.Q(follower=models.F("followed")),
                name="profiles_no_self_follow",
            ),
        ]
        indexes = [
            # Listes paginées « abonnés » / « abonnements », plus récents d'abord.
            models.Index(fields=["followed", "-created_at"]),
            models.Index(fields=["follower", "-created_at"]),
        ]


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
