import pytest

from features.feed import services as feed_services

pytestmark = pytest.mark.django_db(transaction=True)


def test_comments_api(api_client, auth_client, user):
    post = feed_services.create_post(author=user, body="Sujet")
    url = f"/api/discussions/posts/{post.id}/comments/"

    created = auth_client.post(url, {"body": "Premier !"}, format="json")
    assert created.status_code == 201
    listed = api_client.get(url)
    assert [c["body"] for c in listed.data["results"]] == ["Premier !"]

    summary = api_client.get(f"/api/discussions/posts/{post.id}/summary/")
    assert summary.data["points"] == []

    deleted = auth_client.delete(f"/api/discussions/comments/{created.data['id']}/")
    assert deleted.status_code == 204
