"""Écritures (offres d'emploi, événements). Seul point d'entrée en écriture."""

from django.db import transaction

from core.exceptions import DomainError, PermissionDeniedError
from core.utils import normalize_tags

from .models import JobOffer, TechEvent

JOB_FIELDS = (
    "title",
    "company",
    "location",
    "country",
    "is_remote",
    "contract_type",
    "description",
    "apply_url",
    "stack",
    "salary_range",
    "is_active",
)
EVENT_FIELDS = (
    "title",
    "kind",
    "starts_at",
    "ends_at",
    "location",
    "country",
    "is_online",
    "organizer",
    "registration_url",
    "description",
    "tags",
)


def _check_link(value: str, *, required: bool) -> str:
    value = (value or "").strip()
    if not value:
        if required:
            raise DomainError("Un lien est nécessaire.", code="invalid_link")
        return ""
    if not value.startswith(("https://", "http://", "mailto:")):
        raise DomainError(
            "Le lien doit commencer par https://, http:// ou mailto:.", code="invalid_link"
        )
    return value


def _check_owner(item, user) -> None:
    if item.author_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul l'auteur peut modifier cette publication.")


def _clean_job(values: dict) -> dict:
    cleaned = {}
    for name, value in values.items():
        if name not in JOB_FIELDS or value is None:
            continue
        if name == "stack":
            value = normalize_tags(value, limit=12)
        elif name == "apply_url":
            value = _check_link(value, required=True)
        elif isinstance(value, str):
            value = value.strip()
        cleaned[name] = value
    if "contract_type" in cleaned and cleaned["contract_type"] not in JobOffer.Contract.values:
        raise DomainError("Type de contrat inconnu.", code="invalid_job")
    return cleaned


def _clean_event(values: dict, *, current: TechEvent | None = None) -> dict:
    cleaned = {}
    for name, value in values.items():
        if name not in EVENT_FIELDS:
            continue
        if value is None and name != "ends_at":
            continue
        if name == "tags":
            value = normalize_tags(value, limit=8)
        elif name == "registration_url":
            value = _check_link(value, required=False)
        elif isinstance(value, str):
            value = value.strip()
        cleaned[name] = value
    if "kind" in cleaned and cleaned["kind"] not in TechEvent.Kind.values:
        raise DomainError("Type d'événement inconnu.", code="invalid_event")
    starts = cleaned.get("starts_at", current.starts_at if current else None)
    ends = cleaned.get("ends_at", current.ends_at if current else None)
    if starts and ends and ends < starts:
        raise DomainError("La fin doit suivre le début.", code="invalid_event")
    online = cleaned.get("is_online", current.is_online if current else False)
    location = cleaned.get("location", current.location if current else "")
    if not online and not location:
        raise DomainError("Indiquez un lieu, ou cochez « en ligne ».", code="invalid_event")
    return cleaned


@transaction.atomic
def create_job(*, author, **values) -> JobOffer:
    cleaned = _clean_job(values)
    for required in ("title", "company", "description", "contract_type"):
        if not cleaned.get(required):
            raise DomainError(
                "Titre, entreprise, contrat et description sont requis.", code="invalid_job"
            )
    if not cleaned.get("is_remote") and not (cleaned.get("location") or cleaned.get("country")):
        raise DomainError("Indiquez un lieu, ou cochez « télétravail ».", code="invalid_job")
    return JobOffer.objects.create(author=author, **cleaned)


@transaction.atomic
def update_job(*, job: JobOffer, user, **values) -> JobOffer:
    _check_owner(job, user)
    cleaned = _clean_job(values)
    for name, value in cleaned.items():
        setattr(job, name, value)
    if cleaned:
        job.save(update_fields=[*cleaned, "updated_at"])
    return job


def delete_job(*, job: JobOffer, user) -> None:
    _check_owner(job, user)
    job.soft_delete()


@transaction.atomic
def create_event(*, author, **values) -> TechEvent:
    cleaned = _clean_event(values)
    for required in ("title", "kind", "starts_at", "organizer"):
        if not cleaned.get(required):
            raise DomainError(
                "Titre, type, date et organisateur sont requis.", code="invalid_event"
            )
    return TechEvent.objects.create(author=author, **cleaned)


@transaction.atomic
def update_event(*, event: TechEvent, user, **values) -> TechEvent:
    _check_owner(event, user)
    cleaned = _clean_event(values, current=event)
    for name, value in cleaned.items():
        setattr(event, name, value)
    if cleaned:
        event.save(update_fields=[*cleaned, "updated_at"])
    return event


def delete_event(*, event: TechEvent, user) -> None:
    _check_owner(event, user)
    event.soft_delete()
