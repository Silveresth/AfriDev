"""Envoi multi-canal : WebSocket (appli ouverte), push Expo (appli fermée), e-mail (important)."""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.mail import send_mail

from integrations import push

from .models import Notification, NotificationPreference, PushDevice

logger = logging.getLogger(__name__)

# Seuls ces événements méritent aussi un e-mail.
EMAIL_KINDS = {
    Notification.Kind.SNIPPET_FLAGGED,
    Notification.Kind.CONTENT_HIDDEN,
    Notification.Kind.APPLICATION_RECEIVED,
    Notification.Kind.APPLICATION_ANSWERED,
}


def user_group(user_id) -> str:
    return f"notifications.{user_id}"


def payload(notification: Notification) -> dict:
    return {
        "id": str(notification.id),
        "kind": notification.kind,
        "title": notification.title,
        "body": notification.body,
        "data": notification.data,
        "read_at": None,
        "created_at": notification.created_at.isoformat(),
    }


def send_realtime(notification: Notification) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(
        user_group(notification.recipient_id),
        {
            "type": "notification.event",
            "payload": {"event": "notification", **payload(notification)},
        },
    )


def _channel_enabled(notification: Notification, channel: str) -> bool:
    preference = NotificationPreference.objects.filter(user_id=notification.recipient_id).first()
    return preference is None or getattr(preference, f"{channel}_enabled")


def send_push(notification: Notification) -> None:
    if not _channel_enabled(notification, "push"):
        return
    tokens = list(
        PushDevice.objects.filter(user_id=notification.recipient_id).values_list("token", flat=True)
    )
    if not tokens:
        return
    invalid = push.send_push(
        tokens=tokens,
        title=notification.title,
        body=notification.body,
        data={"notification_id": str(notification.id), **notification.data},
    )
    if invalid:
        PushDevice.objects.filter(token__in=invalid).delete()


def send_email(notification: Notification) -> None:
    if notification.kind not in EMAIL_KINDS or not _channel_enabled(notification, "email"):
        return
    email = notification.recipient.email
    if not email:
        return
    send_mail(
        subject=f"AfriDev Exchange — {notification.title}",
        message=f"{notification.body}\n\nOuvrez l'application pour en savoir plus.",
        from_email=None,
        recipient_list=[email],
        fail_silently=False,
    )
