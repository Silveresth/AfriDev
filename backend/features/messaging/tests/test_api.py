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
    assert inbox[0]["last_message_preview"] == "Photo"

    # Le média d'un autre membre ne peut pas être joint.
    kofi = client_for(other_user)
    assert kofi.post(url, {"media_id": str(photo.id)}, format="json").status_code == 400

    # Répondre précisément à la photo : elle est citée au-dessus de la réponse.
    reply = kofi.post(url, {"body": "Belle vue !", "reply_to_id": sent.data["id"]}, format="json")
    assert reply.status_code == 201
    assert reply.data["reply_to"]["id"] == sent.data["id"]
    assert reply.data["reply_to"]["media"]["kind"] == "image"


def _chat(auth_client):
    conversation = auth_client.post(
        "/api/messages/conversations/", {"username": "kofi"}, format="json"
    ).data
    return conversation["id"], f"/api/messages/conversations/{conversation['id']}/messages/"


def test_edit_message(auth_client, client_for, other_user):
    from datetime import timedelta

    from features.messaging.models import Message

    _, url = _chat(auth_client)
    sent = auth_client.post(url, {"body": "Rendez-vous à 18h"}, format="json").data
    edited = auth_client.patch(f"{url}{sent['id']}/", {"body": "Rendez-vous à 19h"}, format="json")
    assert edited.status_code == 200
    assert edited.data["body"] == "Rendez-vous à 19h" and edited.data["edited_at"]
    inbox = client_for(other_user).get("/api/messages/conversations/").data["results"]
    assert inbox[0]["last_message_preview"] == "Rendez-vous à 19h"

    # Seul l'auteur modifie, et pas après 15 minutes.
    kofi = client_for(other_user)
    assert kofi.patch(f"{url}{sent['id']}/", {"body": "x"}, format="json").status_code == 403
    Message.objects.filter(id=sent["id"]).update(
        created_at=Message.objects.get(id=sent["id"]).created_at - timedelta(minutes=16)
    )
    late = auth_client.patch(f"{url}{sent['id']}/", {"body": "20h"}, format="json")
    assert late.status_code == 400 and late.data["error"]["code"] == "edit_expired"


def test_delete_for_me_and_for_everyone(auth_client, client_for, other_user):
    _, url = _chat(auth_client)
    kofi = client_for(other_user)
    first = auth_client.post(url, {"body": "Un"}, format="json").data
    second = auth_client.post(url, {"body": "Deux"}, format="json").data
    theirs = kofi.post(url, {"body": "Trois"}, format="json").data

    # Sélection multiple, supprimée pour moi : l'autre voit toujours tout.
    hidden = auth_client.post(f"{url}delete/", {"ids": [first["id"], theirs["id"]]}, format="json")
    assert hidden.data == {"deleted": 2}
    assert [m["body"] for m in auth_client.get(url).data["results"]] == ["Deux"]
    assert len(kofi.get(url).data["results"]) == 3

    # Pour tout le monde : seulement ses propres messages.
    refused = auth_client.post(
        f"{url}delete/", {"ids": [theirs["id"]], "for_everyone": True}, format="json"
    )
    assert refused.status_code == 403
    revoked = auth_client.post(
        f"{url}delete/", {"ids": [second["id"]], "for_everyone": True}, format="json"
    )
    assert revoked.data == {"deleted": 1}
    seen_by_kofi = {m["id"]: m for m in kofi.get(url).data["results"]}
    assert seen_by_kofi[second["id"]]["revoked"] is True
    assert seen_by_kofi[second["id"]]["body"] == ""
    # Un message supprimé ne peut plus être cité.
    quote = kofi.post(url, {"body": "?", "reply_to_id": second["id"]}, format="json")
    assert quote.status_code == 400


def test_clear_conversation(auth_client, client_for, other_user):
    conversation_id, url = _chat(auth_client)
    kofi = client_for(other_user)
    auth_client.post(url, {"body": "Salut"}, format="json")
    kofi.post(url, {"body": "Hello"}, format="json")

    clear = auth_client.post(f"/api/messages/conversations/{conversation_id}/clear/")
    assert clear.status_code == 204
    assert auth_client.get(url).data["results"] == []
    assert auth_client.get("/api/messages/conversations/").data["results"] == []
    assert len(kofi.get(url).data["results"]) == 2  # l'autre garde tout

    # Un nouveau message fait revenir la discussion, sans l'historique effacé.
    kofi.post(url, {"body": "Tu es là ?"}, format="json")
    assert len(auth_client.get("/api/messages/conversations/").data["results"]) == 1
    assert [m["body"] for m in auth_client.get(url).data["results"]] == ["Tu es là ?"]
