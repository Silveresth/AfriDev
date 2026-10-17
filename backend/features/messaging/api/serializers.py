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


class MessageSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sender_id = serializers.UUIDField()
    body = serializers.CharField(allow_blank=True)
    media = serializers.JSONField(allow_null=True, help_text="Même forme que /api/media/<id>/.")
    created_at = serializers.DateTimeField()


def present_messages(messages) -> list[dict]:
    messages = list(messages)
    media = media_selectors.describe_many(asset_ids={m.media_id for m in messages})
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "body": m.body,
            "media": media.get(m.media_id),
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
