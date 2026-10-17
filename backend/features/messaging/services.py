"""Écritures. Seul point d'entrée en écriture."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from core.exceptions import DomainError, NotFoundError

from .events import message_sent
from .models import Conversation, Message

MAX_LENGTH = 2000


def open_conversation(*, user, other_user_id) -> Conversation:
    """Conversation avec un autre membre, créée au besoin (une seule par duo)."""
    if other_user_id == user.id:
        raise DomainError("Vous ne pouvez pas vous écrire à vous-même.", code="self_message")
    low, high = sorted([user.id, other_user_id], key=str)
    existing = Conversation.objects.filter(user_low_id=low, user_high_id=high).first()
    if existing:
        return existing
    try:
        with transaction.atomic():
            return Conversation.objects.create(user_low_id=low, user_high_id=high)
    except IntegrityError:
        return Conversation.objects.get(user_low_id=low, user_high_id=high)


@transaction.atomic
def send_message(*, conversation: Conversation, sender, body: str) -> Message:
    body = (body or "").strip()
    if not body:
        raise DomainError("Le message est vide.", code="empty_message")
    if len(body) > MAX_LENGTH:
        raise DomainError(f"{MAX_LENGTH} caractères au maximum.", code="message_too_long")
    if sender.id not in (conversation.user_low_id, conversation.user_high_id):
        raise NotFoundError("Conversation introuvable.")
    message = Message.objects.create(conversation=conversation, sender=sender, body=body)
    conversation.last_message_at = message.created_at
    conversation.last_message_preview = " ".join(body.split())[:140]
    conversation.last_sender = sender
    # L'expéditeur a forcément lu la conversation jusqu'à son propre message.
    field = "low_read_at" if conversation.user_low_id == sender.id else "high_read_at"
    setattr(conversation, field, message.created_at)
    conversation.save(
        update_fields=[
            "last_message_at",
            "last_message_preview",
            "last_sender",
            field,
            "updated_at",
        ]
    )
    recipient_id = conversation.other_id(sender.id)
    transaction.on_commit(
        lambda: message_sent.send(
            sender=Message,
            conversation_id=conversation.id,
            sender_id=sender.id,
            recipient_id=recipient_id,
            text=body,
        )
    )
    return message


def mark_read(*, conversation: Conversation, user) -> Conversation:
    field = "low_read_at" if conversation.user_low_id == user.id else "high_read_at"
    setattr(conversation, field, timezone.now())
    conversation.save(update_fields=[field, "updated_at"])
    return conversation
