from django.conf import settings
from django.db import models

from core.models import BaseModel


class Translation(BaseModel):
    """Traduction ou vulgarisation d'un texte, mise en cache par empreinte du contenu."""

    class Mode(models.TextChoices):
        TRANSLATE = "translate", "Traduire"
        SIMPLIFY = "simplify", "Vulgariser"

    class Language(models.TextChoices):
        """Les 16 langues de l'interface ; le libellé, précis, est donné tel quel au modèle d'IA."""

        FR = "fr", "Français"
        EN = "en", "English"
        PT = "pt", "Português"
        AR = "ar", "العربية"
        SW = "sw", "Kiswahili"
        WO = "wo", "Wolof (Sénégal)"
        BM = "bm", "Bambara / Bamanankan (Mali)"
        DYU = "dyu", "Dioula / Julakan (Côte d'Ivoire, Burkina Faso)"
        MOS = "mos", "Mooré / Mòoré (Burkina Faso)"
        HA = "ha", "Hausa"
        YO = "yo", "Yorùbá (avec les tons)"
        IG = "ig", "Igbo"
        LN = "ln", "Lingala"
        RW = "rw", "Kinyarwanda"
        AM = "am", "Amharique (አማርኛ, écriture guèze)"
        ZU = "zu", "isiZulu"

    class Status(models.TextChoices):
        PENDING = "pending", "En cours"
        READY = "ready", "Prête"
        FAILED = "failed", "Échec"

    source_hash = models.CharField(max_length=64)
    source_text = models.TextField(max_length=8000)
    target_language = models.CharField(max_length=5, choices=Language.choices)
    mode = models.CharField(max_length=10, choices=Mode.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    result = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source_hash", "target_language", "mode"], name="translation_unique"
            )
        ]
