import pytest

from features.accounts.models import User

pytestmark = pytest.mark.django_db


def test_delete_account_with_password(auth_client, client_for, user, other_user):
    client_for(other_user).post("/api/profiles/amina/follow/")
    auth_client.post("/api/profiles/kofi/follow/")
    conversation = auth_client.post(
        "/api/messages/conversations/", {"username": "kofi"}, format="json"
    ).data
    auth_client.post(
        f"/api/messages/conversations/{conversation['id']}/messages/", {"body": "Salut"}
    )

    wrong = auth_client.post("/api/accounts/me/delete/", {"password": "nope"}, format="json")
    assert wrong.status_code == 401
    assert User.objects.filter(id=user.id).exists()

    done = auth_client.post(
        "/api/accounts/me/delete/", {"password": "Sup3r-secret-pass"}, format="json"
    )
    assert done.status_code == 204
    assert not User.objects.filter(id=user.id).exists()
    kofi = client_for(other_user).get("/api/profiles/kofi/").data
    assert (kofi["followers_count"], kofi["following_count"]) == (0, 0)
    assert client_for(other_user).get("/api/messages/conversations/").data["results"] == []


def test_delete_account_without_password(client_for, make_user):
    member = make_user("sms_dev")
    member.set_unusable_password()
    member.save()
    client = client_for(member)
    assert client.get("/api/accounts/me/").data["has_password"] is False

    mismatch = client.post("/api/accounts/me/delete/", {"confirm": "autre"}, format="json")
    assert mismatch.status_code == 400
    assert client.post("/api/accounts/me/delete/", {"confirm": "SMS_dev"}).status_code == 204
    assert not User.objects.filter(id=member.id).exists()


def test_superuser_cannot_delete_from_app(client_for, make_user):
    admin = make_user("boss", is_superuser=True, is_staff=True)
    response = client_for(admin).post(
        "/api/accounts/me/delete/", {"password": "Sup3r-secret-pass"}, format="json"
    )
    assert response.status_code == 403
