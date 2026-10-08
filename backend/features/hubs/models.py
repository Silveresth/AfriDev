from django.conf import settings
from django.db import models

from core.models import BaseModel


class Hub(BaseModel):
    """Communauté autonome (façon subreddit) : h/<slug>, ses membres, ses règles, son fil."""

    name = models.CharField(max_length=60)
    slug = models.SlugField(max_length=40, unique=True)
    description = models.TextField(max_length=500, blank=True)
    # Émoji ou URL d'image (pas de téléchargement imposé : l'émoji ne coûte aucun octet).
    icon = models.CharField(max_length=300, blank=True)
    banner_url = models.URLField(blank=True)
    # Règles affichées sur la page du hub, dans l'ordre.
    rules = models.JSONField(default=list, blank=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="hubs_created"
    )
    # Pays visé (« Sénégal ») ; vide = tout le continent.
    target_country = models.CharField(max_length=60, blank=True)
    is_verified = models.BooleanField(default=False)
    member_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["-member_count"])]

    def __str__(self):
        return f"h/{self.slug}"


class HubMembership(BaseModel):
    class Role(models.TextChoices):
        MEMBER = "member", "Membre"
        MODERATOR = "moderator", "Modérateur"

    hub = models.ForeignKey(Hub, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hub_memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["hub", "user"], name="hubs_one_membership")]
