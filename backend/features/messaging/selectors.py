"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, F, Q, QuerySet

from .models import Conversation, Message


def _mine(user_id) -> Q:
    return Q(user_low_id=user_id) | Q(user_high_id=user_id)


def list_conversations(*, user_id) -> QuerySet[Conversation]:
    """Conversations ayant au moins un message, la plus récente d'abord ; une discussion
    supprimée par le membre ne revient qu'avec un nouveau message."""
    not_cleared_low = Q(user_low_id=user_id) & (
        Q(low_cleared_at__isnull=True) | Q(last_message_at__gt=F("low_cleared_at"))
    )
    not_cleared_high = Q(user_high_id=user_id) & (
        Q(high_cleared_at__isnull=True) | Q(last_message_at__gt=F("high_cleared_at"))
    )
    return Conversation.objects.alive().filter(
        not_cleared_low | not_cleared_high, last_message_at__isnull=False
    )


def get_conversation(*, conversation_id, user_id) -> Conversation | None:
    """Seulement si le membre y participe."""
    return Conversation.objects.alive().filter(_mine(user_id), id=conversation_id).first()


def list_messages(*, conversation: Conversation, user_id) -> QuerySet[Message]:
    """Fil tel que le voit ce membre : sans ce qu'il a supprimé pour lui."""
    messages = (
        Message.objects.alive()
        .filter(conversation_id=conversation.id)
        .exclude(Q(sender_id=user_id, hidden_for_sender=True))
        .exclude(Q(hidden_for_recipient=True) & ~Q(sender_id=user_id))
        .select_related("reply_to")
    )
    cleared_at = conversation.cleared_at_for(user_id)
    return messages.filter(created_at__gt=cleared_at) if cleared_at else messages


def get_message(*, conversation: Conversation, message_id) -> Message | None:
    return (
        Message.objects.alive()
        .select_related("conversation")
        .filter(conversation_id=conversation.id, id=message_id)
        .first()
    )


def sent_count(*, conversation_id, sender_id) -> int:
    return (
        Message.objects.alive().filter(conversation_id=conversation_id, sender_id=sender_id).count()
    )


def unread_counts(*, conversations, user_id) -> dict:
    """{conversation_id: messages reçus non lus} en une requête."""
    conversations = list(conversations)
    condition = Q()
    for conversation in conversations:
        read_at = conversation.read_at_for(user_id)
        mine = Q(conversation_id=conversation.id) & ~Q(sender_id=user_id)
        condition |= mine & Q(created_at__gt=read_at) if read_at else mine
    if not conversations:
        return {}
    rows = (
        Message.objects.alive()
        .filter(condition, hidden_for_recipient=False, revoked_at__isnull=True)
        .values("conversation_id")
        .annotate(n=Count("id"))
    )
    return {row["conversation_id"]: row["n"] for row in rows}


def unread_conversation_count(*, user_id) -> int:
    """Nombre de conversations avec au moins un message non lu (pastille de la barre latérale)."""
    conversations = list_conversations(user_id=user_id).exclude(last_sender_id=user_id)
    return sum(1 for n in unread_counts(conversations=conversations, user_id=user_id).values() if n)


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD) : les messages envoyés par le membre."""
    return {
        "messages_sent": list(
            Message.objects.filter(sender_id=user_id).values(
                "conversation_id", "body", "created_at"
            )
        )
    }
