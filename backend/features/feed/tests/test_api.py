import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_feed_is_public_but_writing_requires_login(api_client, auth_client):
    created = auth_client.post("/api/feed/", {"body": "Premier post !"}, format="json")
    assert created.status_code == 201
    assert created.data["author"]["username"] == "amina"

    feed = api_client.get("/api/feed/")
    assert feed.status_code == 200
    assert [p["body"] for p in feed.data["results"]] == ["Premier post !"]
    assert feed.data["results"][0]["viewer"] is None

    assert api_client.post("/api/feed/", {"body": "anonyme"}, format="json").status_code == 401


def test_poll_vote_and_like_through_api(auth_client, client_for, other_user):
    poll = auth_client.post(
        "/api/feed/",
        {"kind": "poll", "body": "Tabs ou espaces ?", "poll_options": ["Tabs", "Espaces"]},
        format="json",
    ).data
    other = client_for(other_user)
    voted = other.post(f"/api/feed/{poll['id']}/vote/", {"option": 1}, format="json")
    assert voted.data["poll_results"] == [0, 1]
    assert voted.data["viewer"] == {"post_vote": 0, "liked": False, "vote": 1}

    # Ancienne API « j'aime » (app mobile) : un vote ↑.
    liked = other.post(f"/api/feed/{poll['id']}/like/", {"liked": True}, format="json")
    assert liked.data["like_count"] == liked.data["score"] == 1
    assert liked.data["viewer"]["post_vote"] == 1


def test_title_score_vote_and_sorts(auth_client, client_for, other_user, user):
    old = auth_client.post(
        "/api/feed/", {"title": "Wave en prod", "body": "Retour d'expérience"}, format="json"
    ).data
    new = auth_client.post("/api/feed/", {"title": "Tout neuf"}, format="json").data
    assert old["title"] == "Wave en prod" and old["score"] == 0

    other = client_for(other_user)
    down = other.post(f"/api/feed/{new['id']}/score/", {"value": -1}, format="json").data
    assert down["score"] == -1 and down["viewer"]["post_vote"] == -1
    other.post(f"/api/feed/{old['id']}/score/", {"value": 1}, format="json")
    up = auth_client.post(f"/api/feed/{old['id']}/score/", {"value": 1}, format="json").data
    assert up["score"] == 2
    assert (
        other.post(f"/api/feed/{old['id']}/score/", {"value": 2}, format="json").status_code == 400
    )

    def titles(sort):
        return [p["title"] for p in other.get("/api/feed/", {"sort": sort}).data["results"]]

    # Score 2 contre -1 : « hot » remonte l'ancien post malgré son âge (quelques ms ici).
    assert titles("new") == ["Tout neuf", "Wave en prod"]
    assert titles("top") == ["Wave en prod", "Tout neuf"]
    assert titles("hot") == ["Wave en prod", "Tout neuf"]


def test_only_author_can_delete(auth_client, client_for, other_user):
    post = auth_client.post("/api/feed/", {"body": "à moi"}, format="json").data
    assert client_for(other_user).delete(f"/api/feed/{post['id']}/").status_code == 403
    assert auth_client.delete(f"/api/feed/{post['id']}/").status_code == 204
    assert auth_client.get(f"/api/feed/{post['id']}/").status_code == 404
