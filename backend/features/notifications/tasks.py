"""Tâches Celery de la feature (file « default »)."""

import logging
import smtplib

from celery import shared_task

from integrations import push

from . import channels
from .models import Notification

logger = logging.getLogger(__name__)


@shared_task(
    autoretry_for=(push.PushError, smtplib.SMTPException), retry_backoff=True, max_retries=3
)
def deliver_notification(notification_id: str) -> None:
    notification = (
        Notification.objects.select_related("recipient").filter(id=notification_id).first()
    )
    if notification is None or notification.read_at is not None:
        return
    channels.send_push(notification)
    channels.send_email(notification)
