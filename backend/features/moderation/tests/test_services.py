import pytest

from core.exceptions import ConflictError, DomainError
from features.feed import selectors as feed_selectors
from features.feed import services as feed_services
from features.moderation import services
from features.moderation.models import Report
from features.notifications import selectors as notification_selectors

pytestmark = pytest.mark.django_db(transaction=True)


def test_reports_hide_content_after_threshold(settings, user, make_user):
    settings.MODERATION_AUTO_HIDE_REPORTS = 2
    post = feed_services.create_post(author=user, body="Gagnez 1 million en Flooz !")
    with pytest.raises(DomainError):
        services.report_content(reporter=user, target_type="post", target_id=post.id, reason="spam")

    first = make_user("rapporteur1")
    services.report_content(reporter=first, target_type="post", target_id=post.id, reason="spam")
    with pytest.raises(ConflictError):
        services.report_content(
            reporter=first, target_type="post", target_id=post.id, reason="spam"
        )
    assert feed_selectors.get_post(post_id=post.id) is not None

    services.report_content(
        reporter=make_user("rapporteur2"), target_type="post", target_id=post.id, reason="scam"
    )
    assert feed_selectors.get_post(post_id=post.id) is None
    assert set(Report.objects.values_list("status", flat=True)) == {"hidden"}
    kinds = [n.kind for n in notification_selectors.list_notifications(user=user)]
    assert "content_hidden" in kinds


def test_ai_screening_hides_obvious_scams(user, fake_llm):
    fake_llm.when(
        "Envoyez 5000 FCFA",
        {"violates": True, "category": "scam", "confidence": 0.97, "explanation": "Arnaque."},
    )
    scam = feed_services.create_post(author=user, body="Envoyez 5000 FCFA pour un emploi garanti")
    fine = feed_services.create_post(author=user, body="Django est mieux que Laravel, débat !")

    assert feed_selectors.get_post(post_id=scam.id) is None
    assert feed_selectors.get_post(post_id=fine.id) is not None
    report = Report.objects.get(target_id=scam.id)
    assert report.reporter is None and report.reason == "scam"


def test_staff_can_dismiss(user, other_user):
    post = feed_services.create_post(author=user, body="Contenu discuté")
    report = services.report_content(
        reporter=other_user, target_type="post", target_id=post.id, reason="off_topic"
    )
    services.resolve_report(report=report, moderator=other_user, action="dismiss")
    report.refresh_from_db()
    assert report.status == "dismissed"
    assert feed_selectors.get_post(post_id=post.id) is not None
