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
    assert hub["viewer"] == {
        "is_member": True,
        "role": "moderator",
        "is_creator": True,
        "can_manage": True,
    }
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


def test_moderators_pin_and_delete_hub_posts(api_client, auth_client, client_for, other_user):
    hub = _hub(auth_client)
    kofi = client_for(other_user)
    kofi.post(f"/api/hubs/{hub['slug']}/join/")
    posts = [
        kofi.post(
            "/api/feed/", {"title": f"Post {i}", "body": "…", "hub_id": hub["id"]}, format="json"
        ).data
        for i in range(5)
    ]
    first = posts[0]["id"]

    # Un simple membre ne peut ni épingler ni supprimer le post d'un autre.
    assert kofi.post(f"/api/feed/{posts[1]['id']}/pin/").status_code in (403, 400)
    pinned = auth_client.post(f"/api/feed/{first}/pin/", {"pinned": True}, format="json")
    assert pinned.status_code == 200 and pinned.data["is_pinned"] is True
    assert pinned.data["viewer"]["can_moderate"] is True

    # Épinglé : en tête de la 1re page (même trié par nouveauté), sans doublon ensuite.
    feed = api_client.get(f"/api/hubs/{hub['slug']}/feed/", {"sort": "new", "page_size": 2})
    assert _ids(feed)[0] == str(first)
    following = api_client.get(feed.data["next"])
    assert str(first) not in _ids(following)

    for post in posts[1:3]:
        auth_client.post(f"/api/feed/{post['id']}/pin/")
    too_many = auth_client.post(f"/api/feed/{posts[3]['id']}/pin/")
    assert too_many.status_code == 400 and too_many.data["error"]["code"] == "too_many_pinned"

    # Le créateur du hub supprime le post d'un membre ; le membre voit son rôle absent.
    assert auth_client.delete(f"/api/feed/{posts[4]['id']}/").status_code == 204
    hub_post = auth_client.post(
        "/api/feed/", {"title": "Annonce", "body": "…", "hub_id": hub["id"]}, format="json"
    ).data
    assert hub_post["author_role"] == "creator"
    assert posts[1]["author_role"] is None


def test_moderators_delete_hub_questions_and_snippets(auth_client, client_for, other_user):
    hub = _hub(auth_client)
    kofi = client_for(other_user)
    kofi.post(f"/api/hubs/{hub['slug']}/join/")
    question = kofi.post(
        "/api/qa/questions/",
        {"title": "Comment migrer ma base ?", "body": "Django 5", "hub_id": hub["id"]},
        format="json",
    ).data
    snippet = kofi.post(
        "/api/snippets/",
        {
            "title": "Salut",
            "language": "python",
            "content": "print(1)",
            "is_public": True,
            "hub_id": hub["id"],
        },
        format="json",
    ).data

    # Vu par le créateur du hub : droits de modération ; vu par l'auteur : aucun.
    assert auth_client.get(f"/api/qa/questions/{question['id']}/").data["can_moderate"] is True
    assert kofi.get(f"/api/qa/questions/{question['id']}/").data["can_moderate"] is False
    public = auth_client.get(f"/api/snippets/public/{snippet['id']}/").data
    assert public["can_moderate"] is True and public["author_role"] is None

    assert auth_client.delete(f"/api/qa/questions/{question['id']}/").status_code == 204
    assert auth_client.delete(f"/api/snippets/public/{snippet['id']}/").status_code == 204


def test_moderators_manage_members(auth_client, client_for, other_user, make_user):
    hub = _hub(auth_client)
    slug = hub["slug"]
    kofi = client_for(other_user)
    zara = make_user("zara")
    zara_client = client_for(zara)
    kofi.post(f"/api/hubs/{slug}/join/")
    zara_client.post(f"/api/hubs/{slug}/join/")
    assert auth_client.get(f"/api/hubs/{slug}/").data["viewer"]["can_manage"] is True
    assert kofi.get(f"/api/hubs/{slug}/").data["viewer"]["can_manage"] is False

    # La liste des membres est réservée à la modération.
    assert kofi.get(f"/api/hubs/{slug}/members/").status_code == 403
    members = auth_client.get(f"/api/hubs/{slug}/members/").data["results"]
    assert {m["user"]["username"] for m in members} == {"amina", "kofi", "zara"}
    assert next(m for m in members if m["user"]["username"] == "amina")["is_creator"] is True
    searched = auth_client.get(f"/api/hubs/{slug}/members/", {"q": "zar"}).data["results"]
    assert [m["user"]["username"] for m in searched] == ["zara"]

    # Kofi devient modérateur : il gère les membres, mais ni le créateur ni un autre modérateur.
    auth_client.post(f"/api/hubs/{slug}/moderators/", {"username": "kofi"}, format="json")
    assert kofi.post(f"/api/hubs/{slug}/members/amina/remove/").status_code == 400
    removed = kofi.post(f"/api/hubs/{slug}/members/zara/remove/", {"ban": True}, format="json")
    assert removed.status_code == 200 and removed.data["member_count"] == 2

    # Exclue : ne peut ni revenir ni publier dans le hub ; la levée de l'exclusion le permet.
    assert zara_client.post(f"/api/hubs/{slug}/join/").status_code == 403
    post = zara_client.post(
        "/api/feed/", {"title": "Retour", "body": "…", "hub_id": hub["id"]}, format="json"
    )
    assert post.status_code == 403
    bans = auth_client.get(f"/api/hubs/{slug}/bans/").data["results"]
    assert [b["user"]["username"] for b in bans] == ["zara"]
    assert auth_client.post(f"/api/hubs/{slug}/bans/zara/lift/").status_code == 204
    assert zara_client.post(f"/api/hubs/{slug}/join/").status_code == 200

    # Seul le créateur retire un modérateur.
    other_mod = make_user("moussa")
    client_for(other_mod).post(f"/api/hubs/{slug}/join/")
    auth_client.post(f"/api/hubs/{slug}/moderators/", {"username": "moussa"}, format="json")
    assert kofi.post(f"/api/hubs/{slug}/members/moussa/remove/").status_code == 403
    assert auth_client.post(f"/api/hubs/{slug}/members/moussa/remove/").status_code == 200


def test_hub_moderator_management(auth_client, client_for, other_user):
    hub = _hub(auth_client)
    slug = hub["slug"]

    # auth_client is creator, assigns other_user (kofi) as moderator
    assign_res = auth_client.post(
        f"/api/hubs/{slug}/moderators/",
        {"username": other_user.username},
        format="json",
    )
    assert assign_res.status_code == 200
    assert any(m["username"] == other_user.username for m in assign_res.data["moderators"])

    # Non-creator (kofi) cannot assign or revoke moderators
    kofi = client_for(other_user)
    forbidden = kofi.post(
        f"/api/hubs/{slug}/moderators/",
        {"username": other_user.username},
        format="json",
    )
    assert forbidden.status_code == 403

    # Creator revokes moderator
    remove_res = auth_client.delete(
        f"/api/hubs/{slug}/moderators/",
        {"username": other_user.username},
        format="json",
    )
    assert remove_res.status_code == 200
    assert all(m["username"] != other_user.username for m in remove_res.data["moderators"])
