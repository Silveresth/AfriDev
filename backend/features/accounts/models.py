import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from core.models import BaseModel


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    # Double authentification par application (TOTP, RFC 6238) : secret base32, activée à la date
    # de confirmation ; dernier pas de 30 s accepté (un code ne sert qu'une fois).
    totp_secret = models.CharField(max_length=64, blank=True)
    totp_enabled_at = models.DateTimeField(null=True, blank=True)
    totp_last_step = models.BigIntegerField(default=0)

    @property
    def two_factor_enabled(self) -> bool:
        return self.totp_enabled_at is not None

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                name="accounts_user_email_ci_unique",
                condition=~models.Q(email=""),
            )
        ]


class SocialAccount(BaseModel):
    """Compte GitHub / GitLab / Google rattaché à un utilisateur."""

    class Provider(models.TextChoices):
        GITHUB = "github", "GitHub"
        GITLAB = "gitlab", "GitLab"
        GOOGLE = "google", "Google"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_accounts")
    provider = models.CharField(max_length=20, choices=Provider.choices)
    uid = models.CharField(max_length=64)
    username = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider", "uid"], name="accounts_social_unique")
        ]

    def __str__(self):
        return f"{self.provider}:{self.username}"


class PhoneOTP(BaseModel):
    """Code à usage unique envoyé par SMS. Seule l'empreinte du code est stockée."""

    phone_number = models.CharField(max_length=20, db_index=True)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)


class UserSession(BaseModel):
    """Appareil connecté : une ligne par connexion, révocable depuis les réglages.

    Son id voyage dans les jetons (claim « sid ») : une session révoquée refuse le
    renouvellement, et ses jetons d'accès sont rejetés dès la révocation.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    user_agent = models.CharField(max_length=300, blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]


class PersonalAccessToken(BaseModel):
    """Clé d'API personnelle (scripts, CI) : seule l'empreinte SHA-256 est stockée."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="access_tokens")
    name = models.CharField(max_length=60)
    # Début du jeton, affiché pour le reconnaître (« afd_Xy3k… »).
    prefix = models.CharField(max_length=12)
    token_hash = models.CharField(max_length=64, unique=True)
    read_only = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
