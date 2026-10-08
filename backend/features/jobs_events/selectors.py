"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from .models import JobOffer, TechEvent


def _json_contains(field: str, value: str) -> Q:
    # Recherche sur le texte JSON : portable PostgreSQL / SQLite (tests), comme les tags du fil.
    return Q(**{f"{field}__icontains": f'"{value.lower()}"'})


def list_jobs(
    *,
    country: str | None = None,
    tech: str | None = None,
    remote: bool | None = None,
    contract: str | None = None,
    query: str | None = None,
    author_id=None,
    active: bool | None = True,
) -> QuerySet[JobOffer]:
    jobs = JobOffer.objects.alive()
    if active is not None:
        jobs = jobs.filter(is_active=active)
    if country:
        jobs = jobs.filter(country__iexact=country)
    if tech:
        jobs = jobs.filter(_json_contains("stack", tech))
    if remote is not None:
        jobs = jobs.filter(is_remote=remote)
    if contract:
        jobs = jobs.filter(contract_type=contract)
    if author_id:
        jobs = jobs.filter(author_id=author_id)
    if query:
        jobs = jobs.filter(
            Q(title__icontains=query)
            | Q(company__icontains=query)
            | Q(description__icontains=query)
        )
    return jobs


def get_job(*, job_id) -> JobOffer | None:
    return JobOffer.objects.alive().filter(id=job_id).first()


def list_events(
    *,
    country: str | None = None,
    kind: str | None = None,
    online: bool | None = None,
    tech: str | None = None,
    query: str | None = None,
    upcoming: bool | None = True,
    author_id=None,
) -> QuerySet[TechEvent]:
    """upcoming : True = à venir ou en cours, False = passés, None = tous."""
    events = TechEvent.objects.alive()
    now = timezone.now()
    # Un événement est en cours tant que sa fin (ou à défaut son début) n'est pas passée.
    not_over = Q(ends_at__gte=now) | Q(ends_at__isnull=True, starts_at__gte=now)
    if upcoming is True:
        events = events.filter(not_over)
    elif upcoming is False:
        events = events.exclude(not_over)
    if country:
        events = events.filter(country__iexact=country)
    if kind:
        events = events.filter(kind=kind)
    if online is not None:
        events = events.filter(is_online=online)
    if tech:
        events = events.filter(_json_contains("tags", tech))
    if author_id:
        events = events.filter(author_id=author_id)
    if query:
        events = events.filter(
            Q(title__icontains=query)
            | Q(organizer__icontains=query)
            | Q(description__icontains=query)
        )
    return events


def get_event(*, event_id) -> TechEvent | None:
    return TechEvent.objects.alive().filter(id=event_id).first()


def _tag_counts(rows) -> list[dict]:
    counts: dict[str, int] = {}
    for tags in rows:
        for tag in tags or []:
            counts[tag] = counts.get(tag, 0) + 1
    return [
        {"value": tag, "count": total}
        for tag, total in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ][:20]


def _country_counts(queryset) -> list[dict]:
    rows = queryset.exclude(country="").values("country").annotate(total=Count("id"))
    return [
        {"value": row["country"], "count": row["total"]}
        for row in sorted(rows, key=lambda row: (-row["total"], row["country"]))
    ]


def job_facets() -> dict:
    """Pays et technologies présents dans les offres actives (filtres de /jobs)."""
    jobs = list_jobs()
    return {
        "countries": _country_counts(jobs),
        "technologies": _tag_counts(jobs.values_list("stack", flat=True)),
    }


def event_facets() -> dict:
    events = list_events()
    return {
        "countries": _country_counts(events),
        "technologies": _tag_counts(events.values_list("tags", flat=True)),
    }


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD)."""
    return {
        "job_offers": list(
            JobOffer.objects.filter(author_id=user_id).values(
                "id", "title", "company", "contract_type", "is_active", "created_at"
            )
        ),
        "tech_events": list(
            TechEvent.objects.filter(author_id=user_id).values(
                "id", "title", "kind", "starts_at", "organizer", "created_at"
            )
        ),
    }
