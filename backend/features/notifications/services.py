"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.db import transaction
from django.utils import timezone

from core.exceptions import DomainError
from integrations import push

from . import channels
from .models import Notification, NotificationPreference, PushDevice


@transaction.atomic
def notify(*, recipient_id, kind: str, title: str, body: str = "", data: dict | None = None):
    """Crée la notification, sauf si le membre a coupé ce type (renvoie alors None)."""
    muted = (
        NotificationPreference.objects.filter(user_id=recipient_id)
        .values_list("muted_kinds", flat=True)
        .first()
    )
    if muted and kind in muted:
        return None
    notification = Notification.objects.create(
        recipient_id=recipient_id,
        kind=kind,
        title=title[:120],
        body=body[:300],
        data=data or {},
    )

    from .tasks import deliver_notification

    def _dispatch():
        channels.send_realtime(notification)
        deliver_notification.delay(str(notification.id))

    transaction.on_commit(_dispatch)
    return notification


def mark_read(*, notification: Notification) -> Notification:
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at", "updated_at"])
    return notification


def mark_all_read(*, user) -> int:
    return Notification.objects.filter(recipient=user, read_at__isnull=True).update(
        read_at=timezone.now()
    )


def delete_notification(*, notification: Notification) -> None:
    notification.soft_delete()


def clear_all(*, user) -> int:
    """Efface toute la boîte de réception (suppression douce, propagée aux copies locales)."""
    return Notification.objects.alive().filter(recipient=user).update(
        deleted_at=timezone.now(), updated_at=timezone.now()
    )


def register_device(*, user, token: str, platform: str = "") -> PushDevice:
    if not push.is_expo_token(token):
        raise DomainError("Jeton Expo invalide.", code="invalid_push_token")
    device, _ = PushDevice.objects.update_or_create(
        token=token, defaults={"user": user, "platform": platform}
    )
    return device


def unregister_device(*, user, token: str) -> None:
    PushDevice.objects.filter(user=user, token=token).delete()


def update_preferences(*, user, **fields) -> NotificationPreference:
    preference, _ = NotificationPreference.objects.get_or_create(user=user)
    changed = []
    if fields.get("muted_kinds") is not None:
        preference.muted_kinds = [
            kind
            for kind in dict.fromkeys(fields["muted_kinds"])
            if kind in Notification.Kind.values
        ]
        changed.append("muted_kinds")
    for name in ("push_enabled", "email_enabled"):
        if fields.get(name) is not None:
            setattr(preference, name, bool(fields[name]))
            changed.append(name)
    if changed:
        preference.save(update_fields=[*changed, "updated_at"])
    return preference
