import pytest
from django.core import mail

from core.exceptions import DomainError
from features.feed import services as feed_services
from features.notifications import selectors, services
from features.notifications.models import PushDevice

pytestmark = pytest.mark.django_db(transaction=True)


def test_like_notifies_author_but_not_self_like(user, other_user):
    post = feed_services.create_post(author=user, body="Mon post")
    feed_services.set_like(post=post, user=user, liked=True)
    assert selectors.unread_count(user=user) == 0

    feed_services.set_like(post=post, user=other_user, liked=True)
    [notification] = selectors.list_notifications(user=user)
    assert notification.kind == "post_liked"
    assert notification.title == "Kofi aime votre post"
    assert notification.data == {"type": "post", "id": str(post.id)}


def test_push_is_sent_to_registered_devices(user, monkeypatch):
    sent = []

    def fake_push(*, tokens, title, body, data):
        sent.append(tokens)
        return ["ExponentPushToken[old]"]  # appareil désinstallé

    monkeypatch.setattr("integrations.push.send_push", fake_push)
    services.register_device(user=user, token="ExponentPushToken[new]", platform="android")
    services.register_device(user=user, token="ExponentPushToken[old]", platform="android")
    with pytest.raises(DomainError):
        services.register_device(user=user, token="pas-un-jeton")

    services.notify(recipient_id=user.id, kind="new_answer", title="Nouvelle réponse")
    assert sorted(sent[0]) == ["ExponentPushToken[new]", "ExponentPushToken[old]"]
    assert list(PushDevice.objects.values_list("token", flat=True)) == ["ExponentPushToken[new]"]


def test_important_kinds_also_send_an_email(user):
    services.notify(recipient_id=user.id, kind="new_comment", title="Commentaire")
    assert mail.outbox == []
    services.notify(recipient_id=user.id, kind="content_hidden", title="Contenu masqué")
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["amina@example.com"]


def test_mark_all_read(user):
    services.notify(recipient_id=user.id, kind="new_comment", title="A")
    services.notify(recipient_id=user.id, kind="new_comment", title="B")
    assert services.mark_all_read(user=user) == 2
    assert selectors.unread_count(user=user) == 0
