"""Notifications push via le service Expo (relaie vers FCM / APNs)."""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

_BATCH = 100


class PushError(Exception):
    pass


def is_expo_token(token: str) -> bool:
    return token.startswith(("ExponentPushToken[", "ExpoPushToken["))


def send_push(*, tokens: list[str], title: str, body: str, data: dict | None = None) -> list[str]:
    """Envoie la notification et renvoie les jetons à supprimer (appareil désinstallé)."""
    messages = [
        {"to": token, "title": title, "body": body, "data": data or {}, "sound": "default"}
        for token in tokens
        if is_expo_token(token)
    ]
    if not messages:
        return []

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

    invalid: list[str] = []
    with httpx.Client(timeout=15) as client:
        for start in range(0, len(messages), _BATCH):
            batch = messages[start : start + _BATCH]
            try:
                response = client.post(settings.EXPO_PUSH_URL, json=batch, headers=headers)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise PushError(str(exc)) from exc
            for message, ticket in zip(batch, response.json().get("data", []), strict=False):
                if ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                    invalid.append(message["to"])
    return invalid
