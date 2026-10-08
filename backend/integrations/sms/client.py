"""Fournisseur SMS / USSD africain : Africa's Talking (couverture Togo à vérifier).

Sans SMS_PROVIDER_API_KEY (dev, tests), le message est seulement journalisé.
"""

import logging
import re

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class SMSError(Exception):
    pass


def normalize_phone(phone: str) -> str:
    """Format international E.164 (+22890123456). Lève ValueError si invalide."""
    cleaned = re.sub(r"[\s().-]", "", phone or "")
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if not _E164.match(cleaned):
        raise ValueError("Numéro de téléphone invalide (format attendu : +22890123456).")
    return cleaned


def _endpoint() -> str:
    sandbox = settings.SMS_PROVIDER_USERNAME == "sandbox"
    host = "api.sandbox.africastalking.com" if sandbox else "api.africastalking.com"
    return f"https://{host}/version1/messaging"


def send_sms(*, to: str, message: str) -> None:
    if not settings.SMS_PROVIDER_API_KEY:
        logger.warning("SMS non envoyé (aucun fournisseur configuré) to=%s message=%s", to, message)
        return

    data = {"username": settings.SMS_PROVIDER_USERNAME, "to": to, "message": message}
    if settings.SMS_SENDER_ID:
        data["from"] = settings.SMS_SENDER_ID
    try:
        response = httpx.post(
            _endpoint(),
            headers={"apiKey": settings.SMS_PROVIDER_API_KEY, "Accept": "application/json"},
            data=data,
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise SMSError(str(exc)) from exc

    recipients = response.json().get("SMSMessageData", {}).get("Recipients", [])
    if not recipients or recipients[0].get("status") != "Success":
        raise SMSError(f"Envoi refusé : {recipients}")


def ussd_response(text: str, *, end: bool) -> str:
    """Réponse au format attendu par la passerelle USSD (« CON » continue, « END » termine)."""
    return ("END " if end else "CON ") + text
