from rest_framework import serializers

from core.serializers import AuthorSerializer


class OpenConversationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)


class MessageInputSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)


class MessageSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sender_id = serializers.UUIDField()
    body = serializers.CharField()
    created_at = serializers.DateTimeField()


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
