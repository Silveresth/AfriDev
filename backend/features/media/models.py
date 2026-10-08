from django.conf import settings
from django.db import models

from core.models import BaseModel


class MediaAsset(BaseModel):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Vidéo courte"
        AUDIO = "audio", "Message vocal"

    class Status(models.TextChoices):
        PROCESSING = "processing", "En traitement"
        READY = "ready", "Prêt"
        FAILED = "failed", "Échec"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="media_assets"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PROCESSING)
    original_path = models.CharField(max_length=300)
    mime_type = models.CharField(max_length=100)
    size_bytes = models.PositiveBigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    # Aperçu flou de quelques octets affiché avant le chargement (base64).
    thumbhash = models.CharField(max_length=64, blank=True)
    # Chemins des variantes : {"small": …, "large": …, "avif": …, "hls": …, "poster": …, "opus": …}
    variants = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "-created_at"])]
