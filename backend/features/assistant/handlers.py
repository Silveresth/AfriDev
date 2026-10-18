"""Détection d'arnaques dans les messages privés (IA), sans bloquer l'envoi."""

from django.dispatch import receiver

from features.messaging import selectors as messaging_selectors
from features.messaging.events import message_sent
from features.profiles import selectors as profile_selectors
from integrations import llm

from .tasks import ai_screen_message

MIN_LENGTH = 25
# Seuls les premiers messages d'un inconnu sont analysés : c'est là que se jouent les arnaques,
# et une discussion entre membres qui se connaissent reste privée.
FIRST_MESSAGES = 3


@receiver(message_sent)
def screen_first_messages(
    sender, message_id, conversation_id, sender_id, recipient_id, body="", **kw
):
    if len(body or "") < MIN_LENGTH or not llm.is_configured():
        return
    if profile_selectors.is_following(follower_id=recipient_id, followed_id=sender_id):
        return
    if (
        messaging_selectors.sent_count(conversation_id=conversation_id, sender_id=sender_id)
        > FIRST_MESSAGES
    ):
        return
    ai_screen_message.delay(str(message_id), body)
