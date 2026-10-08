import pytest

from features.feed import services as feed_services
from features.qa import services as qa_services

pytestmark = pytest.mark.django_db


def test_communities_rank_tags_by_activity(api_client, user):
    feed_services.create_post(author=user, body="Astuce", tags=["wave", "redis"])
    feed_services.create_post(author=user, body="Encore", tags=["wave"])
    qa_services.create_question(
        author=user, title="Question sur Wave ?", body="…", tags=["wave", "django"]
    )

    rows = api_client.get("/api/feed/communities/", {"limit": 2}).data
    assert rows[0] == {"tag": "wave", "posts": 2, "questions": 1}
    assert len(rows) == 2
