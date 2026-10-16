import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from features.feed import home, services
from features.profiles import services as profile_services

pytestmark = pytest.mark.django_db


def _seed(user, other_user, client_for):
    kofi = client_for(other_user)
    for n in range(3):
        services.create_post(author=other_user, title=f"Astuce {n}", body="…", tags=["python"])
    kofi.post(
        "/api/qa/questions/",
        {"title": "Comment déployer Django ?", "body": "…", "tags": ["django"]},
        format="json",
    )
    kofi.post(
        "/api/snippets/",
        {"title": "Backup", "language": "bash", "content": "pg_dump", "is_public": True},
        format="json",
    )
    kofi.post(
        "/api/snippets/",
        {"title": "Privé", "language": "bash", "content": "secret", "is_public": False},
        format="json",
    )


def test_home_mixes_content_types(api_client, client_for, user, other_user):
    _seed(user, other_user, client_for)
    data = api_client.get("/api/feed/home/").data
    types = [item["type"] for item in data["results"]]
    assert {"post", "question", "snippet"} <= set(types)
    # Le snippet privé n'apparaît jamais.
    titles = [item["card"]["title"] for item in data["results"] if item["card"]]
    assert "Privé" not in titles
    post = next(item for item in data["results"] if item["type"] == "post")
    assert post["post"]["author"]["username"] == "kofi" and post["card"] is None
    question = next(item for item in data["results"] if item["type"] == "question")
    assert question["card"]["url"].startswith("/questions/")
    assert question["card"]["meta"]["answer_count"] == 0


def test_home_never_puts_three_of_a_kind_in_a_row_when_avoidable():
    cards = [{"type": "post", "_score": 10 - i} for i in range(4)] + [
        {"type": "question", "_score": 1}
    ]
    ordered = [card["type"] for card in home._interleave(cards)]
    assert ordered[:3] == ["post", "post", "question"]


def test_home_filter_and_interests(auth_client, client_for, user, other_user):
    _seed(user, other_user, client_for)
    only = auth_client.get("/api/feed/home/?filter=questions").data["results"]
    assert [item["type"] for item in only] == ["question"]

    profile_services.save_preferences(profile=user.profile, topics=[], stack=["django"])
    first = auth_client.get("/api/feed/home/?filter=questions").data["results"][0]
    assert first["matched_tags"] == ["django"]


def test_home_following_scope(auth_client, api_client, client_for, user, other_user, make_user):
    _seed(user, other_user, client_for)
    stranger = make_user("zola")
    services.create_post(author=stranger, title="Inconnu", body="…")

    assert auth_client.get("/api/feed/home/?scope=following").data["results"] == []
    profile_services.follow(follower=user, followed=other_user.profile)
    rows = auth_client.get("/api/feed/home/?scope=following").data["results"]
    authors = {(item["post"] or item["card"])["author"]["username"] for item in rows}
    assert authors == {"kofi"}
    assert api_client.get("/api/feed/home/?scope=following").status_code == 401


def test_home_paginates_without_duplicates(api_client, other_user):
    for n in range(45):
        services.create_post(author=other_user, title=f"Post {n}", body="…")
    seen, url, pages = [], "/api/feed/home/?filter=posts", 0
    while url and pages < 5:
        data = api_client.get(url).data
        seen += [item["id"] for item in data["results"]]
        url = data["next"]
        pages += 1
    assert len(seen) == 45 and len(set(seen)) == 45


def test_home_rejects_bad_parameters(api_client):
    assert api_client.get("/api/feed/home/?filter=nope").status_code == 400
    assert api_client.get("/api/feed/home/?cursor=%%%").status_code == 400


def test_home_query_count_is_bounded(api_client, client_for, user, other_user):
    _seed(user, other_user, client_for)
    with CaptureQueriesContext(connection) as ctx:
        api_client.get("/api/feed/home/")
    small = len(ctx)
    for n in range(10):
        services.create_post(author=other_user, title=f"Plus {n}", body="…")
    with CaptureQueriesContext(connection) as ctx:
        api_client.get("/api/feed/home/")
    # Le nombre de requêtes ne dépend pas du nombre d'éléments affichés.
    assert len(ctx) <= small + 1 and len(ctx) < 20
