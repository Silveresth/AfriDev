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


# ── Modération renforcée ──


def test_insult_in_comment_is_hidden_instantly_without_ai(user, other_user):
    """Filtre local : aucune IA configurée dans les tests, l'insulte est masquée quand même."""
    from features.discussions import selectors as discussion_selectors
    from features.discussions import services as discussion_services

    post = feed_services.create_post(author=user, body="Mon premier composant React")
    insult = discussion_services.create_comment(
        author=other_user, post_id=post.id, body="Ton code est nul, t'es un c0nnard"
    )
    polite = discussion_services.create_comment(
        author=other_user, post_id=post.id, body="Ton code est nul, revois les hooks."
    )
    assert discussion_selectors.get_comment(comment_id=insult.id) is None
    assert discussion_selectors.get_comment(comment_id=polite.id) is not None
    report = Report.objects.get(target_id=insult.id)
    assert report.reason == "abuse" and report.status == "hidden"


def test_editing_a_clean_post_into_an_insult_is_caught(user):
    post = feed_services.create_post(author=user, body="Bonjour à tous")
    feed_services.update_post(post=post, user=user, body="Bonjour bande de fils de pute")
    assert feed_selectors.get_post(post_id=post.id) is None


def test_country_names_are_never_flagged(user):
    post = feed_services.create_post(
        author=user, body="Meetup dev au Niger et au Nigeria ce samedi"
    )
    assert feed_selectors.get_post(post_id=post.id) is not None
    assert not Report.objects.exists()


def test_ai_hides_from_075_and_only_reports_doubtful_content(user, fake_llm):
    fake_llm.when(
        "MARQUEUR-MEPRIS",
        {"violates": True, "category": "insult", "confidence": 0.8, "explanation": "Mépris."},
    )
    fake_llm.when(
        "MARQUEUR-DOUTE",
        {"violates": True, "category": "insult", "confidence": 0.6, "explanation": "Douteux."},
    )
    rude = feed_services.create_post(author=user, body="Tu ne sais rien MARQUEUR-MEPRIS")
    doubtful = feed_services.create_post(author=user, body="Ton article MARQUEUR-DOUTE")
    assert feed_selectors.get_post(post_id=rude.id) is None
    assert (
        feed_selectors.get_post(post_id=doubtful.id) is not None
    )  # visible, en attente d'un humain
    assert Report.objects.get(target_id=doubtful.id).status == "open"


def test_snippet_comments_are_moderated_and_restorable(user, other_user):
    from features.snippets import selectors as snippet_selectors
    from features.snippets import services as snippet_services

    snippet = snippet_services.create_snippet(
        owner=user, title="Tri rapide", language="python", content="x = 1", is_public=True
    )
    comment = snippet_services.add_comment(snippet=snippet, author=other_user, body="fuck you")
    assert snippet_selectors.get_comment(comment_id=comment.id) is None
    report = Report.objects.get(target_type="snippet_comment", target_id=comment.id)
    services.resolve_report(report=report, moderator=user, action="restore")
    assert snippet_selectors.get_comment(comment_id=comment.id) is not None
