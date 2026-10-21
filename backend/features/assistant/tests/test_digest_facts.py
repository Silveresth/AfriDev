import pytest

from features.assistant import context
from features.feed import services as feed_services

pytestmark = pytest.mark.django_db(transaction=True)


def test_digest_lists_popular_post_of_the_day(user):
    post = feed_services.create_post(author=user, title="Astuce Django du jour", body="…")
    text, count = context.digest_facts(user_id=user.id)
    assert f"POST populaire : Astuce Django du jour — /feed/{post.id}" in text
    assert count >= 1
