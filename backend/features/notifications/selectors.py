"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import QuerySet

from .models import Notification


def list_notifications(*, user, unread_only: bool = False) -> QuerySet[Notification]:
    notifications = Notification.objects.alive().filter(recipient=user)
    if unread_only:
        notifications = notifications.filter(read_at__isnull=True)
    return notifications


def unread_count(*, user) -> int:
    return list_notifications(user=user, unread_only=True).count()


def get_notification(*, user, notification_id) -> Notification | None:
    return list_notifications(user=user).filter(id=notification_id).first()


def get_preferences(*, user):
    from .models import NotificationPreference

    return NotificationPreference.objects.filter(user=user).first() or NotificationPreference(
        user=user
    )
