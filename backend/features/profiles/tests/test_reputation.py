import pytest

from features.profiles import selectors, services

pytestmark = pytest.mark.django_db(transaction=True)


def _karma(user):
    return selectors.get_profile_for_user(user_id=user.id)


def test_upvotes_accepted_answers_and_saves(auth_client, client_for, user, other_user, make_user):
    kofi = client_for(other_user)
    fatou = client_for(make_user("fatou"))

    post = auth_client.post("/api/feed/", {"title": "Astuce", "body": "…"}, format="json").data
    kofi.post(f"/api/feed/{post['id']}/score/", {"value": 1}, format="json")
    fatou.post(f"/api/feed/{post['id']}/score/", {"value": 1}, format="json")
    auth_client.post(f"/api/feed/{post['id']}/score/", {"value": 1}, format="json")  # soi-même
    assert _karma(user).karma_score == 10  # 2 votes ↑ d'autres membres × 5

    fatou.post(f"/api/feed/{post['id']}/score/", {"value": 0}, format="json")
    assert _karma(user).karma_score == 5  # vote retiré : le karma baisse

    question = kofi.post(
        "/api/qa/questions/",
        {"title": "Comment gérer les migrations ?", "body": "…", "tags": ["django"]},
        format="json",
    ).data
    answer = auth_client.post(
        f"/api/qa/questions/{question['id']}/answers/", {"body": "Avec squash."}, format="json"
    ).data
    kofi.post(f"/api/qa/answers/{answer['id']}/accept/")
    profile = _karma(user)
    assert profile.karma_details["accepted_answers"] == 1
    assert profile.karma_score == 5 + 15

    snippet = auth_client.post(
        "/api/snippets/",
        {"title": "Backup", "language": "bash", "content": "pg_dump db", "is_public": True},
        format="json",
    ).data
    kofi.post(
        "/api/bookmarks/quick-save/",
        {"target_type": "snippet", "target_id": snippet["id"]},
        format="json",
    )
    assert _karma(user).karma_score == 5 + 15 + 10

    card = auth_client.get(f"/api/feed/{post['id']}/").data["author"]
    assert card["karma"] == 30

    public = auth_client.get("/api/profiles/amina/").data
    assert public["karma_score"] == 30
    assert public["karma_details"] == {"upvotes": 1, "accepted_answers": 1, "snippet_saves": 1}


def test_badges(client_for, make_user):
    expert = make_user("expert")
    asker = make_user("asker")
    expert_client, asker_client = client_for(expert), client_for(asker)
    for n in range(3):
        question = asker_client.post(
            "/api/qa/questions/",
            {"title": f"Question python numéro {n}", "body": "…", "tags": ["python"]},
            format="json",
        ).data
        answer = expert_client.post(
            f"/api/qa/questions/{question['id']}/answers/", {"body": "Voici."}, format="json"
        ).data
        asker_client.post(f"/api/qa/answers/{answer['id']}/accept/")

    badges = {b["code"]: b for b in _karma(expert).badges}
    assert badges["expert-python"]["label"] == "Expert Python"
    assert "top-5-entraide" in badges  # seul membre avec des réponses acceptées
    assert "contributeur-majeur" not in badges  # 45 points

    first_award = badges["expert-python"]["awarded_at"]
    services.recompute_reputation(user_id=expert.id)
    assert {b["code"]: b for b in _karma(expert).badges}["expert-python"]["awarded_at"] == (
        first_award
    )  # la date d'obtention est conservée
