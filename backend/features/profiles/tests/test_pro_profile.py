import pytest

from features.profiles import selectors, services

pytestmark = pytest.mark.django_db(transaction=True)


def _set_stack(user, stack):
    services.update_profile(profile=selectors.get_profile_for_user(user_id=user.id), stack=stack)


def test_open_to_work_details(auth_client, api_client):
    updated = auth_client.patch(
        "/api/profiles/me/",
        {
            "open_to_work": True,
            "work_preferences": ["freelance", "mentorat", "freelance"],
            "daily_rate": "150 000 FCFA / jour",
            "availability_note": "Disponible en novembre",
        },
        format="json",
    )
    assert updated.status_code == 200, updated.data
    assert updated.data["work_preferences"] == ["freelance", "mentorat"]
    public = api_client.get("/api/profiles/amina/").data
    assert public["daily_rate"] == "150 000 FCFA / jour"
    bad = auth_client.patch(
        "/api/profiles/me/", {"work_preferences": ["astronaute"]}, format="json"
    )
    assert bad.status_code == 400


def test_pinned_items(auth_client, api_client, client_for, other_user):
    post = auth_client.post("/api/feed/", {"title": "Mon retour", "body": "…"}, format="json").data
    snippet = auth_client.post(
        "/api/snippets/",
        {"title": "Backup", "language": "bash", "content": "pg_dump", "is_public": True},
        format="json",
    ).data
    private = auth_client.post(
        "/api/snippets/", {"title": "Perso", "language": "bash", "content": "ls"}, format="json"
    ).data
    others = (
        client_for(other_user)
        .post("/api/feed/", {"title": "Pas à moi", "body": "…"}, format="json")
        .data
    )

    pinned = auth_client.put(
        "/api/profiles/me/pinned/",
        {
            "items": [
                {"target_type": "snippet", "target_id": snippet["id"]},
                {"target_type": "post", "target_id": post["id"]},
            ]
        },
        format="json",
    )
    assert pinned.status_code == 200, pinned.data
    public = api_client.get("/api/profiles/amina/").data
    assert [p["title"] for p in public["pinned"]] == ["Backup", "Mon retour"]
    assert public["pinned"][0]["href"] == f"/snippets/{snippet['id']}"

    for item in (
        {"target_type": "snippet", "target_id": private["id"]},
        {"target_type": "post", "target_id": others["id"]},
    ):
        refused = auth_client.put("/api/profiles/me/pinned/", {"items": [item]}, format="json")
        assert refused.status_code == 400

    too_many = auth_client.put(
        "/api/profiles/me/pinned/",
        {"items": [{"target_type": "post", "target_id": post["id"]}] * 4},
        format="json",
    )
    assert too_many.status_code == 400

    auth_client.delete(f"/api/feed/{post['id']}/")
    assert [p["title"] for p in api_client.get("/api/profiles/amina/").data["pinned"]] == ["Backup"]


def test_endorsements(auth_client, api_client, client_for, user, other_user, make_user):
    _set_stack(user, ["react native", "django"])
    kofi, fatou = client_for(other_user), client_for(make_user("fatou"))

    endorsed = kofi.post(
        "/api/profiles/amina/endorsements/", {"skill": "React Native"}, format="json"
    )
    assert endorsed.status_code == 200, endorsed.data
    fatou.post("/api/profiles/amina/endorsements/", {"skill": "react native"}, format="json")
    kofi.post("/api/profiles/amina/endorsements/", {"skill": "react native"}, format="json")

    rows = {row["skill"]: row for row in kofi.get("/api/profiles/amina/endorsements/").data}
    assert rows["react native"]["count"] == 2
    assert rows["react native"]["endorsed_by_me"] is True
    assert {e["username"] for e in rows["react native"]["endorsers"]} == {"kofi", "fatou"}
    assert rows["django"]["count"] == 0

    assert (
        auth_client.post(
            "/api/profiles/amina/endorsements/", {"skill": "django"}, format="json"
        ).status_code
        == 400
    )  # pas soi-même
    assert (
        kofi.post(
            "/api/profiles/amina/endorsements/", {"skill": "cobol"}, format="json"
        ).status_code
        == 404
    )  # hors de la stack
    withdrawn = kofi.delete("/api/profiles/amina/endorsements/?skill=react%20native")
    assert {r["skill"]: r for r in withdrawn.data}["react native"]["count"] == 1
    assert api_client.get("/api/profiles/amina/endorsements/").status_code == 200


def test_github_overview(api_client, auth_client, monkeypatch):
    calls = []

    def fake_overview(username):
        calls.append(username)
        return {
            "login": username,
            "html_url": f"https://github.com/{username}",
            "public_repos": 12,
            "followers": 30,
            "total_stars": 140,
            "top_languages": [{"name": "Python", "repos": 7}],
            "top_repos": [],
        }

    monkeypatch.setattr("integrations.github.get_user_overview", fake_overview)
    assert api_client.get("/api/profiles/amina/github/").status_code == 404  # pas de compte lié
    auth_client.patch("/api/profiles/me/", {"github_username": "amina-dev"}, format="json")
    first = api_client.get("/api/profiles/amina/github/")
    assert first.status_code == 200 and first.data["total_stars"] == 140
    api_client.get("/api/profiles/amina/github/")
    assert calls == ["amina-dev"]  # deuxième lecture servie par le cache
