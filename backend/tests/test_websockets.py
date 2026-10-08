"""Temps réel de bout en bout : application ASGI complète, JWT en paramètre d'URL."""

import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from features.discussions import services as discussion_services
from features.feed import services as feed_services
from features.notifications import services as notification_services

pytestmark = pytest.mark.django_db(transaction=True)


def _receive_after(url: str, action):
    async def scenario():
        communicator = WebsocketCommunicator(application, url)
        connected, _ = await communicator.connect()
        assert connected
        await database_sync_to_async(action)()
        message = await communicator.receive_json_from(timeout=2)
        await communicator.disconnect()
        return message

    return async_to_sync(scenario)()


def test_connection_without_token_is_refused(user):
    post = feed_services.create_post(author=user, body="Privé")

    async def scenario():
        communicator = WebsocketCommunicator(application, f"/ws/discussions/{post.id}/")
        connected, _ = await communicator.connect()
        return connected

    assert async_to_sync(scenario)() is False


def test_comments_are_pushed_live(user, other_user):
    post = feed_services.create_post(author=user, body="En direct")
    token = str(AccessToken.for_user(user))

    message = _receive_after(
        f"/ws/discussions/{post.id}/?token={token}",
        lambda: discussion_services.create_comment(
            author=other_user, post_id=post.id, body="Bonjour en direct"
        ),
    )
    assert message["event"] == "comment.created"
    assert message["comment"]["body"] == "Bonjour en direct"


def test_notifications_are_pushed_live(user):
    token = str(AccessToken.for_user(user))
    message = _receive_after(
        f"/ws/notifications/?token={token}",
        lambda: notification_services.notify(
            recipient_id=user.id, kind="new_comment", title="En direct"
        ),
    )
    assert message["event"] == "notification" and message["title"] == "En direct"
