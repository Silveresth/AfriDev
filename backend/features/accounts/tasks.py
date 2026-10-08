"""Tâches Celery de la feature (file « sms »)."""

from celery import shared_task

from integrations import sms


@shared_task(autoretry_for=(sms.SMSError,), retry_backoff=True, max_retries=3)
def send_otp_sms(phone_number: str, code: str) -> None:
    sms.send_sms(
        to=phone_number,
        message=f"AfriDev : votre code de connexion est {code}. Il expire dans 5 minutes.",
    )
