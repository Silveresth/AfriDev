"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.exceptions import ConflictError, DomainError, NotFoundError

from .events import content_hidden
from .models import Report
from .targets import TARGETS

AI_CATEGORY_TO_REASON = {
    "spam": Report.Reason.SPAM,
    "abuse": Report.Reason.ABUSE,
    "scam": Report.Reason.SCAM,
}


def _target(target_type: str):
    target = TARGETS.get(target_type)
    if target is None:
        raise DomainError(f"Type de contenu inconnu : {target_type}.", code="invalid_target")
    return target


@transaction.atomic
def report_content(*, reporter, target_type: str, target_id, reason: str, details: str = ""):
    content = _target(target_type).load(target_id)
    if content is None:
        raise NotFoundError("Contenu introuvable.")
    if content.author_id == reporter.id:
        raise DomainError("Vous ne pouvez pas signaler votre propre contenu.", code="own_content")
    already = Report.objects.filter(
        reporter=reporter, target_type=target_type, target_id=target_id
    ).exists()
    if already:
        raise ConflictError("Vous avez déjà signalé ce contenu.", code="already_reported")

    report = Report.objects.create(
        reporter=reporter,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        details=details.strip(),
    )
    open_reports = Report.objects.filter(
        target_type=target_type, target_id=target_id, status=Report.Status.OPEN
    ).count()
    if open_reports >= settings.MODERATION_AUTO_HIDE_REPORTS:
        hide_target(target_type=target_type, target_id=target_id, reason=reason)
    else:
        from .tasks import ai_review_report

        transaction.on_commit(lambda: ai_review_report.delay(str(report.id)))
    return report


@transaction.atomic
def hide_target(*, target_type: str, target_id, reason: str, moderator=None) -> None:
    """Masque le contenu et clôt tous ses signalements ouverts."""
    target = _target(target_type)
    content = target.load(target_id)
    target.hide(target_id)
    Report.objects.filter(
        target_type=target_type, target_id=target_id, status=Report.Status.OPEN
    ).update(status=Report.Status.HIDDEN, resolved_by=moderator, resolved_at=timezone.now())
    if content is not None:
        transaction.on_commit(
            lambda: content_hidden.send(
                sender=Report,
                target_type=target_type,
                target_id=target_id,
                author_id=content.author_id,
                reason=reason,
            )
        )


@transaction.atomic
def restore_target(*, target_type: str, target_id, moderator) -> None:
    """Annule un masquage jugé abusif : le contenu réapparaît, ses signalements sont rejetés."""
    _target(target_type).restore(target_id)
    Report.objects.filter(
        target_type=target_type, target_id=target_id, status=Report.Status.HIDDEN
    ).update(status=Report.Status.DISMISSED, resolved_by=moderator, resolved_at=timezone.now())


@transaction.atomic
def resolve_report(*, report: Report, moderator, action: str) -> Report:
    """hide / dismiss sur un signalement ouvert ; restore sur un contenu déjà masqué."""
    if action == "restore":
        if report.status != Report.Status.HIDDEN:
            raise ConflictError("Ce contenu n'est pas masqué.", code="not_hidden")
        restore_target(
            target_type=report.target_type, target_id=report.target_id, moderator=moderator
        )
        report.refresh_from_db()
        return report
    if report.status != Report.Status.OPEN:
        raise ConflictError("Ce signalement est déjà traité.", code="already_resolved")
    if action == "hide":
        hide_target(
            target_type=report.target_type,
            target_id=report.target_id,
            reason=report.reason,
            moderator=moderator,
        )
    elif action == "dismiss":
        Report.objects.filter(
            target_type=report.target_type, target_id=report.target_id, status=Report.Status.OPEN
        ).update(status=Report.Status.DISMISSED, resolved_by=moderator, resolved_at=timezone.now())
    else:
        raise DomainError("Action inconnue (hide, dismiss ou restore).", code="invalid_action")
    report.refresh_from_db()
    return report


def store_ai_verdict(*, report_id, verdict: dict) -> None:
    report = Report.objects.filter(id=report_id, status=Report.Status.OPEN).first()
    if report is None:
        return
    report.ai_verdict = verdict
    report.save(update_fields=["ai_verdict", "updated_at"])
    if verdict["violates"] and verdict["confidence"] >= settings.MODERATION_AI_HIDE_CONFIDENCE:
        hide_target(
            target_type=report.target_type, target_id=report.target_id, reason=report.reason
        )


def flag_from_screening(*, target_type: str, target_id, verdict: dict) -> None:
    """Contenu neuf jugé en infraction par l'IA : signalement automatique, masqué si sûr."""
    if not verdict["violates"]:
        return
    with transaction.atomic():
        Report.objects.create(
            reporter=None,
            target_type=target_type,
            target_id=target_id,
            reason=AI_CATEGORY_TO_REASON.get(verdict["category"], Report.Reason.OTHER),
            details=verdict["explanation"],
            ai_verdict=verdict,
        )
        if verdict["confidence"] >= settings.MODERATION_AI_HIDE_CONFIDENCE:
            hide_target(target_type=target_type, target_id=target_id, reason=verdict["category"])
