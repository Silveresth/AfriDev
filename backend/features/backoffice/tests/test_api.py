import pytest

from features.discussions import services as discussion_services
from features.feed import selectors as feed_selectors
from features.feed import services as feed_services
from features.moderation import services as moderation_services
from features.qa import services as qa_services

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def moderator(make_user):
    return make_user("moderatrice", is_staff=True)


@pytest.fixture
def admin(make_user):
    return make_user("cheffe", is_staff=True, is_superuser=True)


def test_backoffice_is_staff_only(auth_client):
    assert auth_client.get("/api/backoffice/dashboard/").status_code == 403
    assert auth_client.get("/api/backoffice/members/").status_code == 403


def test_dashboard_counts_activity(client_for, moderator, user, other_user):
    post = feed_services.create_post(author=user, body="Astuce Wave")
    discussion_services.create_comment(author=other_user, post_id=post.id, body="Merci !")
    qa_services.create_question(author=user, title="Comment gérer les webhooks ?", body="Détails")
    moderation_services.report_content(
        reporter=other_user, target_type="post", target_id=post.id, reason="spam"
    )

    response = client_for(moderator).get("/api/backoffice/dashboard/", {"days": 7})
    assert response.status_code == 200
    data = response.data
    assert data["period_days"] == 7
    assert data["members"]["total"] == 3
    assert data["members"]["staff"] == 1
    assert data["content"]["posts"]["new"] == 1
    assert data["content"]["comments"]["total"] == 1
    assert data["content"]["qa"]["unanswered"] == 1
    assert data["moderation"]["open"] == 1
    assert len(data["timeline"]) == 7
    today = data["timeline"][-1]
    assert today["posts"] == 1 and today["comments"] == 1 and today["qa"] == 1
    assert data["unanswered_questions"][0]["title"] == "Comment gérer les webhooks ?"


def test_moderation_queue_shows_content_and_restores_it(client_for, moderator, user, other_user):
    post = feed_services.create_post(author=user, body="Contenu signalé à tort")
    report = moderation_services.report_content(
        reporter=other_user, target_type="post", target_id=post.id, reason="spam"
    )
    staff = client_for(moderator)

    queue = staff.get("/api/moderation/reports/", {"status": "open"}).data["results"]
    assert queue[0]["content"]["text"] == "Contenu signalé à tort"
    assert queue[0]["content"]["author"]["username"] == "amina"
    assert queue[0]["reporter"]["username"] == other_user.username
    assert queue[0]["report_count"] == 1

    hidden = staff.post(
        f"/api/moderation/reports/{report.id}/resolve/", {"action": "hide"}, format="json"
    )
    assert hidden.data["status"] == "hidden"
    assert hidden.data["content"]["hidden"] is True
    assert hidden.data["resolved_by"]["username"] == "moderatrice"
    assert feed_selectors.get_post(post_id=post.id) is None

    restored = staff.post(
        f"/api/moderation/reports/{report.id}/resolve/", {"action": "restore"}, format="json"
    )
    assert restored.data["status"] == "dismissed"
    assert restored.data["content"]["hidden"] is False
    assert feed_selectors.get_post(post_id=post.id) is not None


def test_restoring_an_answer_recounts_it(user, other_user, moderator):
    question = qa_services.create_question(author=user, title="Question de test longue", body="?")
    answer = qa_services.create_answer(author=other_user, question=question, body="Réponse")
    moderation_services.hide_target(target_type="answer", target_id=answer.id, reason="spam")
    question.refresh_from_db()
    assert question.answer_count == 0
    moderation_services.restore_target(
        target_type="answer", target_id=answer.id, moderator=moderator
    )
    question.refresh_from_db()
    assert question.answer_count == 1


def test_members_search_and_suspend(client_for, moderator, user, api_client):
    staff = client_for(moderator)
    found = staff.get("/api/backoffice/members/", {"q": "amin"}).data["results"]
    assert [member["username"] for member in found] == ["amina"]

    suspended = staff.patch(
        f"/api/backoffice/members/{user.id}/", {"is_active": False}, format="json"
    )
    assert suspended.status_code == 200
    assert suspended.data["is_active"] is False
    assert [
        m["username"]
        for m in staff.get("/api/backoffice/members/", {"role": "suspended"}).data["results"]
    ] == ["amina"]

    # Un compte suspendu ne peut plus se connecter, avec un message explicite.
    login = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
    )
    assert login.status_code == 403
    assert login.data["error"]["code"] == "account_suspended"


def test_suspended_member_tokens_stop_working(client_for, moderator, user, api_client):
    tokens = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
    ).data["tokens"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert api_client.get("/api/accounts/me/").status_code == 200

    client_for(moderator).patch(
        f"/api/backoffice/members/{user.id}/", {"is_active": False}, format="json"
    )
    assert api_client.get("/api/accounts/me/").status_code == 401


def test_team_management_rules(client_for, moderator, admin, user):
    staff = client_for(moderator)
    # Un modérateur ne gère ni l'équipe, ni son propre compte, ni un autre membre du staff.
    assert (
        staff.patch(
            f"/api/backoffice/members/{user.id}/", {"is_staff": True}, format="json"
        ).status_code
        == 403
    )
    assert (
        staff.patch(
            f"/api/backoffice/members/{moderator.id}/", {"is_active": False}, format="json"
        ).status_code
        == 403
    )
    assert (
        staff.patch(
            f"/api/backoffice/members/{admin.id}/", {"is_active": False}, format="json"
        ).status_code
        == 403
    )

    boss = client_for(admin)
    promoted = boss.patch(f"/api/backoffice/members/{user.id}/", {"is_staff": True}, format="json")
    assert promoted.data["is_staff"] is True
    assert (
        boss.patch(
            f"/api/backoffice/members/{moderator.id}/", {"is_active": False}, format="json"
        ).status_code
        == 200
    )


def test_me_exposes_staff_flags(client_for, moderator):
    me = client_for(moderator).get("/api/accounts/me/").data
    assert me["is_staff"] is True and me["is_superuser"] is False
