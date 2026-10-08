import pytest

from features.feed import services as feed_services

pytestmark = pytest.mark.django_db(transaction=True)


def test_report_queue_is_staff_only(auth_client, client_for, other_user, make_user):
    post = feed_services.create_post(author=other_user, body="Douteux")
    created = auth_client.post(
        "/api/moderation/reports/",
        {"target_type": "post", "target_id": str(post.id), "reason": "spam"},
        format="json",
    )
    assert created.status_code == 201
    assert auth_client.get("/api/moderation/reports/").status_code == 403

    moderator = make_user("moderatrice", is_staff=True)
    staff = client_for(moderator)
    queue = staff.get("/api/moderation/reports/", {"status": "open"})
    assert len(queue.data["results"]) == 1

    resolved = staff.post(
        f"/api/moderation/reports/{created.data['id']}/resolve/", {"action": "hide"}, format="json"
    )
    assert resolved.data["status"] == "hidden"
