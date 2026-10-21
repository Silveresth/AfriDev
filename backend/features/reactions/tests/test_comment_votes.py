import pytest

from features.discussions import services as discussion_services
from features.feed import services as feed_services

pytestmark = pytest.mark.django_db(transaction=True)


def test_vote_on_post_comment_shows_in_list(api_client, auth_client, user):
    post = feed_services.create_post(author=user, body="Sujet")
    comment = discussion_services.create_comment(author=user, post_id=post.id, body="Utile")
    url = f"/api/reactions/comment/{comment.id}/"

    up = auth_client.post(url, {"value": 1}, format="json")
    assert up.status_code == 200
    assert up.data["score"] == 1 and up.data["viewer_vote"] == 1

    listed = auth_client.get(f"/api/discussions/posts/{post.id}/comments/")
    row = listed.data["results"][0]
    assert (row["score"], row["viewer_vote"]) == (1, 1)
    # Visiteur anonyme : le score, sans vote personnel.
    anonymous = api_client.get(f"/api/discussions/posts/{post.id}/comments/")
    assert (anonymous.data["results"][0]["score"], anonymous.data["results"][0]["viewer_vote"]) == (
        1,
        0,
    )

    down = auth_client.post(url, {"value": -1}, format="json")
    assert down.data["score"] == -1
    removed = auth_client.post(url, {"value": 0}, format="json")
    assert removed.data["score"] == 0 and removed.data["viewer_vote"] == 0


def test_vote_on_unknown_comment_is_404(auth_client):
    response = auth_client.post(
        "/api/reactions/comment/00000000-0000-0000-0000-000000000000/", {"value": 1}, format="json"
    )
    assert response.status_code == 404


def test_report_comment_of_another_member(auth_client, user, other_user):
    post = feed_services.create_post(author=user, body="Sujet")
    comment = discussion_services.create_comment(
        author=other_user, post_id=post.id, body="Spam ici"
    )
    response = auth_client.post(
        "/api/moderation/reports/",
        {"target_type": "comment", "target_id": str(comment.id), "reason": "spam", "details": ""},
        format="json",
    )
    assert response.status_code in (200, 201)
