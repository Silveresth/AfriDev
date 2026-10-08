import uuid

import pytest

from core.exceptions import NotFoundError
from features.discussions import selectors, services
from features.feed import services as feed_services

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def post(user):
    return feed_services.create_post(author=user, body="Sujet de discussion")


def test_comment_requires_existing_post(user):
    with pytest.raises(NotFoundError):
        services.create_comment(author=user, post_id=uuid.uuid4(), body="Perdu")


def test_replies_must_belong_to_the_same_post(user, post):
    other_post = feed_services.create_post(author=user, body="Autre")
    parent = services.create_comment(author=user, post_id=post.id, body="Parent")
    with pytest.raises(NotFoundError):
        services.create_comment(author=user, post_id=other_post.id, body="x", parent_id=parent.id)
    reply = services.create_comment(
        author=user, post_id=post.id, body="Réponse", parent_id=parent.id
    )
    assert reply.parent_id == parent.id


def test_summary_is_generated_after_five_comments(user, other_user, post, fake_llm):
    fake_llm.when("3 points", {"points": ["Point A", "Point B", "Point C", "Point D"]})
    for index in range(4):
        services.create_comment(author=other_user, post_id=post.id, body=f"Avis {index}")
    assert selectors.get_summary(post_id=post.id) is None

    services.create_comment(author=user, post_id=post.id, body="Cinquième avis")
    summary = selectors.get_summary(post_id=post.id)
    assert summary.points == ["Point A", "Point B", "Point C"]
    assert summary.comment_count == 5
