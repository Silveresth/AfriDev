import pytest

pytestmark = pytest.mark.django_db


def test_direct_messages_flow(auth_client, client_for, user, other_user, make_user):
    opened = auth_client.post("/api/messages/conversations/", {"username": "kofi"}, format="json")
    assert opened.status_code == 200
    conversation_id = opened.data["id"]
    again = auth_client.post("/api/messages/conversations/", {"username": "kofi"}, format="json")
    assert again.data["id"] == conversation_id  # une seule conversation par duo

    # Vide tant qu'aucun message : n'apparaît pas dans la boîte de réception.
    assert auth_client.get("/api/messages/conversations/").data["results"] == []

    url = f"/api/messages/conversations/{conversation_id}/messages/"
    sent = auth_client.post(
        url, {"body": "Salut Kofi, dispo pour un pair programming ?"}, format="json"
    )
    assert sent.status_code == 201

    kofi = client_for(other_user)
    assert kofi.get("/api/messages/unread/").data == {"unread": 1}
    inbox = kofi.get("/api/messages/conversations/").data["results"]
    assert inbox[0]["other"]["username"] == "amina"
    assert inbox[0]["unread"] == 1 and inbox[0]["last_message_mine"] is False

    kofi.post(url, {"body": "Oui, ce soir !"}, format="json")
    messages = kofi.get(url).data["results"]
    assert [m["body"] for m in messages] == [
        "Oui, ce soir !",
        "Salut Kofi, dispo pour un pair programming ?",
    ]
    assert kofi.get("/api/messages/unread/").data == {"unread": 0}  # répondre vaut lecture

    assert auth_client.get("/api/messages/unread/").data == {"unread": 1}
    auth_client.post(f"/api/messages/conversations/{conversation_id}/read/")
    assert auth_client.get("/api/messages/unread/").data == {"unread": 0}

    # Un tiers n'y a pas accès.
    outsider = client_for(make_user("awa"))
    assert outsider.get(url).status_code == 404
    assert outsider.post(url, {"body": "Coucou"}, format="json").status_code == 404


def test_cannot_message_yourself(auth_client):
    response = auth_client.post(
        "/api/messages/conversations/", {"username": "amina"}, format="json"
    )
    assert response.status_code == 400


def test_photo_message(auth_client, client_for, user, other_user):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from features.media import services as media_services

    photo = media_services.upload_media(
        owner=user,
        kind="image",
        uploaded_file=SimpleUploadedFile("photo.png", b"\x89PNG fake", content_type="image/png"),
    )
    conversation = auth_client.post(
        "/api/messages/conversations/", {"username": "kofi"}, format="json"
    ).data
    url = f"/api/messages/conversations/{conversation['id']}/messages/"
    sent = auth_client.post(url, {"media_id": str(photo.id)}, format="json")
    assert sent.status_code == 201
    assert sent.data["media"]["kind"] == "image" and sent.data["body"] == ""

    inbox = client_for(other_user).get("/api/messages/conversations/").data["results"]
    assert inbox[0]["last_message_preview"] == "📷 Photo"

    # Le média d'un autre membre ne peut pas être joint.
    kofi = client_for(other_user)
    assert kofi.post(url, {"media_id": str(photo.id)}, format="json").status_code == 400
