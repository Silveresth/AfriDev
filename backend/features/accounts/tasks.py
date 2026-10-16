"""Tâches Celery de la feature (file « sms » : SMS et e-mails de compte)."""

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from integrations import sms


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def send_password_reset_email(email: str, link: str) -> None:
    send_mail(
        subject="AfriDev : réinitialiser votre mot de passe",
        message=(
            "Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n"
            f"{link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : "
            "votre mot de passe actuel reste valable.\n\nL'équipe AfriDev"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )


@shared_task(autoretry_for=(sms.SMSError,), retry_backoff=True, max_retries=3)
def send_otp_sms(phone_number: str, code: str) -> None:
    sms.send_sms(
        to=phone_number,
        message=f"AfriDev : votre code de connexion est {code}. Il expire dans 5 minutes.",
    )
