"""Tâches Celery de la feature (file « sms » : e-mails de compte)."""

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def send_password_reset_email(email: str, link: str, code: str = "") -> None:
    in_app = (
        f"Dans l'appli AfriDev, saisissez ce code (valable 15 minutes) :\n\n    {code}\n\n"
        "Sur le site, ouvrez plutôt ce lien (valable 1 heure) :\n"
        if code
        else "Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n"
    )
    send_mail(
        subject=f"AfriDev : votre code {code}"
        if code
        else "AfriDev : réinitialiser votre mot de passe",
        message=(
            f"Bonjour,\n\n{in_app}{link}\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : "
            "votre mot de passe actuel reste valable.\n\nL'équipe AfriDev"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def send_verification_email(email: str, link: str) -> None:
    send_mail(
        subject="AfriDev : confirmez votre adresse e-mail",
        message=(
            "Bonjour,\n\nBienvenue sur AfriDev ! Pour confirmer que cette adresse est bien la "
            f"vôtre, ouvrez ce lien (valable 3 jours) :\n{link}\n\n"
            "Si vous n'avez pas créé de compte, ignorez cet e-mail : personne ne pourra "
            "s'en servir sans votre confirmation.\n\n"
            "L'équipe AfriDev"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )
