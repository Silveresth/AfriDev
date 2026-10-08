"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, QuerySet

from features.profiles import selectors as profile_selectors

from .models import Report
from .targets import TARGETS, Content

PREVIEW_LENGTH = 1200


def list_reports(
    *, status: str | None = None, target_type: str | None = None, source: str | None = None
) -> QuerySet[Report]:
    """source : "ai" (signalé par l'analyse automatique) ou "member"."""
    reports = Report.objects.alive()
    if status:
        reports = reports.filter(status=status)
    if target_type:
        reports = reports.filter(target_type=target_type)
    if source == "ai":
        reports = reports.filter(reporter__isnull=True)
    elif source == "member":
        reports = reports.filter(reporter__isnull=False)
    return reports


def get_report(*, report_id) -> Report | None:
    return Report.objects.alive().filter(id=report_id).first()


def load_target_text(*, target_type: str, target_id) -> str | None:
    target = TARGETS.get(target_type)
    content = target.load(target_id) if target else None
    return content.text if content else None


def queue_context(*, reports: list[Report]) -> dict:
    """Ce que le back-office affiche autour d'un lot de signalements, en peu de requêtes :
    aperçu du contenu (même masqué), auteurs, signaleurs, modérateurs, nombre de signalements."""
    contents: dict[tuple, Content | None] = {}
    for report in reports:
        key = (report.target_type, report.target_id)
        if key not in contents:
            target = TARGETS.get(report.target_type)
            contents[key] = target.load(report.target_id, include_hidden=True) if target else None

    counts = {
        (row["target_type"], row["target_id"]): row["total"]
        for row in Report.objects.alive()
        .filter(target_id__in={report.target_id for report in reports})
        .values("target_type", "target_id")
        .annotate(total=Count("id"))
    }
    people = {content.author_id for content in contents.values() if content}
    for report in reports:
        people.update(filter(None, [report.reporter_id, report.resolved_by_id]))
    cards = profile_selectors.author_cards(user_ids=people)

    context = {}
    for report in reports:
        key = (report.target_type, report.target_id)
        content = contents.get(key)
        context[report.id] = {
            "content": {
                "text": content.text[:PREVIEW_LENGTH],
                "url": content.url,
                "hidden": content.hidden,
                "author": cards.get(content.author_id),
            }
            if content
            else None,
            "reporter": cards.get(report.reporter_id),
            "resolved_by": cards.get(report.resolved_by_id),
            "report_count": counts.get(key, 1),
        }
    return context


def report_stats(*, since) -> dict:
    reports = Report.objects.alive()
    by_status = dict(reports.values_list("status").annotate(n=Count("id")).order_by())
    recent = reports.filter(created_at__gte=since)
    return {
        "open": by_status.get(Report.Status.OPEN, 0),
        "by_status": by_status,
        "new": recent.count(),
        "new_from_ai": recent.filter(reporter__isnull=True).count(),
        "by_reason": dict(recent.values_list("reason").annotate(n=Count("id")).order_by()),
    }
