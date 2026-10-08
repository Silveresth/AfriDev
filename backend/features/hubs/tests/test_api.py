import uuid

import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def _ids(response) -> list[str]:
    return [str(row["id"]) for row in response.data["results"]]


def _hub(client, **extra):
    payload = {"name": "Python Sénégal", "description": "Les pythonistes de Dakar", **extra}
    response = client.post("/api/hubs/", payload, format="json")
    assert response.status_code == 201, response.data
    return response.data


def test_create_join_and_leave(api_client, auth_client, client_for, other_user):
    hub = _hub(auth_client, icon="🐍", rules=["Soyez bienveillants", " "], target_country="Sénégal")
    assert hub["slug"] == "python-senegal"
    assert hub["rules"] == ["Soyez bienveillants"]
    assert hub["member_count"] == 1
    assert hub["viewer"] == {"is_member": True, "role": "moderator"}
    assert [m["username"] for m in hub["moderators"]] == ["amina"]

    taken = auth_client.post(
        "/api/hubs/", {"name": "Autre", "slug": "python-senegal"}, format="json"
    )
    assert taken.status_code == 409 and taken.data["error"]["code"] == "slug_taken"

    kofi = client_for(other_user)
    joined = kofi.post("/api/hubs/python-senegal/join/")
    assert joined.data["member_count"] == 2 and joined.data["viewer"]["role"] == "member"
    again = kofi.post("/api/hubs/python-senegal/join/")
    assert again.data["member_count"] == 2  # idempotent

    mine = kofi.get("/api/hubs/", {"mine": "true"})
    assert [h["slug"] for h in mine.data["results"]] == ["python-senegal"]
    assert api_client.get("/api/hubs/", {"mine": "true"}).data["results"] == []

    left = kofi.delete("/api/hubs/python-senegal/join/")
    assert left.data["member_count"] == 1 and left.data["viewer"]["is_member"] is False

    creator_leaves = auth_client.delete("/api/hubs/python-senegal/join/")
    assert creator_leaves.status_code == 400

    public = api_client.get("/api/hubs/python-senegal/")
    assert public.data["viewer"] is None


def test_only_moderators_edit(auth_client, client_for, other_user):
    _hub(auth_client)
    kofi = client_for(other_user)
    assert (
        kofi.patch("/api/hubs/python-senegal/", {"name": "Volé"}, format="json").status_code == 403
    )
    edited = auth_client.patch(
        "/api/hubs/python-senegal/", {"rules": ["Pas de spam"]}, format="json"
    )
    assert edited.data["rules"] == ["Pas de spam"]


def test_invalid_slug(auth_client):
    bad = auth_client.post("/api/hubs/", {"name": "X", "slug": "Pas Bon!"}, format="json")
    assert bad.status_code == 400


def test_contents_attach_to_hub(api_client, auth_client):
    hub = _hub(auth_client)
    in_hub = auth_client.post(
        "/api/feed/",
        {"title": "Bonjour le hub", "body": "Premier post", "hub_id": hub["id"]},
        format="json",
    )
    assert in_hub.status_code == 201
    assert in_hub.data["hub"]["slug"] == "python-senegal"
    outside = auth_client.post(
        "/api/feed/", {"title": "Ailleurs", "body": "Hors hub"}, format="json"
    )
    assert outside.data["hub"] is None

    hub_feed = api_client.get("/api/hubs/python-senegal/feed/", {"sort": "new"})
    assert _ids(hub_feed) == [str(in_hub.data["id"])]
    by_param = api_client.get("/api/feed/", {"hub": "python-senegal"})
    assert _ids(by_param) == [str(in_hub.data["id"])]
    assert api_client.get("/api/feed/", {"hub": "inconnu"}).data["results"] == []
    assert api_client.get("/api/hubs/inconnu/feed/").status_code == 404

    unknown = auth_client.post(
        "/api/feed/", {"title": "Perdu", "body": "?", "hub_id": str(uuid.uuid4())}, format="json"
    )
    assert unknown.status_code == 404

    question = auth_client.post(
        "/api/qa/questions/",
        {"title": "Comment déployer Django ?", "body": "Sur un VPS", "hub_id": hub["id"]},
        format="json",
    )
    assert question.data["hub"]["slug"] == "python-senegal"
    listed = api_client.get("/api/qa/questions/", {"hub": hub["id"]})
    assert _ids(listed) == [str(question.data["id"])]

    snippet = auth_client.post(
        "/api/snippets/",
        {
            "title": "Bonjour",
            "language": "python",
            "content": "print('salut')",
            "is_public": True,
            "hub_id": hub["id"],
        },
        format="json",
    )
    assert str(snippet.data["hub_id"]) == str(hub["id"])
    public = api_client.get("/api/snippets/public/", {"hub": "python-senegal"})
    assert _ids(public) == [str(snippet.data["id"])]
    assert public.data["results"][0]["hub"]["name"] == "Python Sénégal"


def test_move_post_out_of_hub(auth_client):
    hub = _hub(auth_client)
    post = auth_client.post(
        "/api/feed/", {"title": "Déplacé", "body": "…", "hub_id": hub["id"]}, format="json"
    ).data
    moved = auth_client.patch(f"/api/feed/{post['id']}/", {"hub_id": None}, format="json")
    assert moved.data["hub"] is None
    untouched = auth_client.patch(f"/api/feed/{post['id']}/", {"title": "Renommé"}, format="json")
    assert untouched.data["hub"] is None and untouched.data["title"] == "Renommé"
