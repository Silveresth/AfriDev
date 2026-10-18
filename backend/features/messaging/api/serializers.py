from rest_framework import serializers

from core.serializers import AuthorSerializer
from features.media import selectors as media_selectors


class OpenConversationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)


class MessageInputSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    media_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Photo, vidéo ou vocal déjà envoyé (/api/media/).",
    )
    reply_to_id = serializers.UUIDField(
        required=False, allow_null=True, help_text="Message de la conversation auquel on répond."
    )


class MessageEditSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, allow_blank=True)


class MessageDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=100)
    for_everyone = serializers.BooleanField(
        default=False, help_text="Vrai : effacé chez les deux (ses propres messages, 2 jours)."
    )


class DeletedCountSerializer(serializers.Serializer):
    deleted = serializers.IntegerField()


class QuotedMessageSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sender_id = serializers.UUIDField()
    body = serializers.CharField(allow_blank=True)
    media = serializers.JSONField(allow_null=True)
    revoked = serializers.BooleanField()


class MessageSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sender_id = serializers.UUIDField()
    body = serializers.CharField(allow_blank=True)
    media = serializers.JSONField(allow_null=True, help_text="Même forme que /api/media/<id>/.")
    reply_to = QuotedMessageSerializer(allow_null=True, help_text="Message cité (réponse).")
    edited_at = serializers.DateTimeField(allow_null=True)
    revoked = serializers.BooleanField(help_text="Supprimé pour tout le monde.")
    risk_note = serializers.CharField(
        allow_blank=True, help_text="Avertissement d'arnaque (IA), seulement pour le destinataire."
    )
    created_at = serializers.DateTimeField()


def present_messages(messages, *, viewer_id=None) -> list[dict]:
    messages = list(messages)
    quoted = [m.reply_to for m in messages if m.reply_to_id and m.reply_to]
    media = media_selectors.describe_many(
        asset_ids={m.media_id for m in messages} | {q.media_id for q in quoted}
    )

    def _quote(q):
        if q is None or q.deleted_at:
            return None
        return {
            "id": q.id,
            "sender_id": q.sender_id,
            "body": q.body,
            "media": media.get(q.media_id),
            "revoked": q.revoked_at is not None,
        }

    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "body": m.body,
            "media": media.get(m.media_id),
            "reply_to": _quote(m.reply_to) if m.reply_to_id else None,
            "edited_at": m.edited_at,
            "revoked": m.revoked_at is not None,
            "risk_note": m.risk_note if m.sender_id != viewer_id and not m.revoked_at else "",
            "created_at": m.created_at,
        }
        for m in messages
    ]


class ConversationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    other = AuthorSerializer(allow_null=True, help_text="L'autre participant.")
    last_message_preview = serializers.CharField(allow_blank=True)
    last_message_at = serializers.DateTimeField(allow_null=True)
    last_message_mine = serializers.BooleanField()
    unread = serializers.IntegerField()
    other_read_at = serializers.DateTimeField(
        allow_null=True, help_text="Lu par l'autre jusqu'à cette date (« Vu »)."
    )


class UnreadMessagesSerializer(serializers.Serializer):
    unread = serializers.IntegerField(help_text="Conversations avec des messages non lus.")


def present_conversations(conversations, *, user_id, cards: dict, unread: dict) -> list[dict]:
    return [
        {
            "id": c.id,
            "other": cards.get(c.other_id(user_id)),
            "last_message_preview": c.last_message_preview,
            "last_message_at": c.last_message_at,
            "last_message_mine": c.last_sender_id == user_id,
            "unread": unread.get(c.id, 0),
            "other_read_at": c.read_at_for(c.other_id(user_id)),
        }
        for c in conversations
    ]
