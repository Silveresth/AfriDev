from django.conf import settings
from django.db import models

from core.models import BaseModel


class JobOffer(BaseModel):
    """Offre d'emploi ou de mission publiée sur le Job Board."""

    class Contract(models.TextChoices):
        CDI = "cdi", "CDI"
        CDD = "cdd", "CDD"
        FREELANCE = "freelance", "Freelance"
        INTERNSHIP = "stage", "Stage"
        APPRENTICESHIP = "alternance", "Alternance"
        PART_TIME = "temps_partiel", "Temps partiel"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="job_offers"
    )
    title = models.CharField(max_length=120)
    company = models.CharField(max_length=100)
    # Ville ou quartier ; le pays est à part pour les filtres.
    location = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=60, blank=True, db_index=True)
    is_remote = models.BooleanField(default=False)
    contract_type = models.CharField(max_length=15, choices=Contract.choices)
    description = models.TextField(max_length=6000)
    # Lien de candidature (https://… ou mailto:…).
    apply_url = models.CharField(max_length=300)
    # Technologies demandées (même forme que les tags).
    stack = models.JSONField(default=list, blank=True)
    salary_range = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["is_active", "-created_at"])]

    def __str__(self):
        return f"{self.title} — {self.company}"


class TechEvent(BaseModel):
    """Meetup, hackathon, webinar ou conférence tech en Afrique (ou en ligne)."""

    class Kind(models.TextChoices):
        MEETUP = "meetup", "Meetup"
        HACKATHON = "hackathon", "Hackathon"
        WEBINAR = "webinar", "Webinar"
        CONFERENCE = "conference", "Conférence"
        WORKSHOP = "atelier", "Atelier"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tech_events"
    )
    title = models.CharField(max_length=120)
    kind = models.CharField(max_length=12, choices=Kind.choices)
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    # Lieu physique (salle, ville) ; vide pour un événement en ligne.
    location = models.CharField(max_length=150, blank=True)
    country = models.CharField(max_length=60, blank=True, db_index=True)
    is_online = models.BooleanField(default=False)
    organizer = models.CharField(max_length=100)
    registration_url = models.CharField(max_length=300, blank=True)
    description = models.TextField(max_length=6000, blank=True)
    tags = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.title
