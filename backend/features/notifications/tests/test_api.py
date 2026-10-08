import pytest

from features.notifications import services

pytestmark = pytest.mark.django_db(transaction=True)


def test_notifications_api(auth_client, user):
    notification = services.notify(recipient_id=user.id, kind="new_answer", title="Réponse")
    assert auth_client.get("/api/notifications/unread-count/").data == {"unread": 1}

    listed = auth_client.get("/api/notifications/", {"unread": "true"})
    assert [n["title"] for n in listed.data["results"]] == ["Réponse"]

    read = auth_client.post(f"/api/notifications/{notification.id}/read/")
    assert read.data["read_at"] is not None
    assert auth_client.get("/api/notifications/unread-count/").data == {"unread": 0}

    device = auth_client.post(
        "/api/notifications/devices/", {"token": "ExponentPushToken[abc]"}, format="json"
    )
    assert device.status_code == 204


def test_delete_and_clear(auth_client, user):
    first = services.notify(recipient_id=user.id, kind="new_answer", title="Un")
    services.notify(recipient_id=user.id, kind="new_answer", title="Deux")

    assert auth_client.delete(f"/api/notifications/{first.id}/").status_code == 204
    assert auth_client.delete(f"/api/notifications/{first.id}/").status_code == 404
    titles = [n["title"] for n in auth_client.get("/api/notifications/").data["results"]]
    assert titles == ["Deux"]

    assert auth_client.delete("/api/notifications/").status_code == 204
    assert auth_client.get("/api/notifications/").data["results"] == []
    assert auth_client.get("/api/notifications/unread-count/").data == {"unread": 0}


def test_preferences_mute_kinds(auth_client, user):
    prefs = auth_client.get("/api/notifications/preferences/").data
    assert prefs["muted_kinds"] == [] and prefs["push_enabled"] is True
    assert any(kind["value"] == "post_liked" for kind in prefs["kinds"])

    updated = auth_client.patch(
        "/api/notifications/preferences/",
        {"muted_kinds": ["post_liked"], "email_enabled": False},
        format="json",
    )
    assert updated.data["muted_kinds"] == ["post_liked"] and updated.data["email_enabled"] is False
    assert services.notify(recipient_id=user.id, kind="post_liked", title="Like") is None
    assert services.notify(recipient_id=user.id, kind="new_answer", title="Réponse") is not None
