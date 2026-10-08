from rest_framework import serializers

from core.serializers import AuthorSerializer
from features.profiles import selectors as profile_selectors


class CommentInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    body = serializers.CharField(max_length=2000)
    parent_id = serializers.UUIDField(required=False, allow_null=True)


class CommentOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    post_id = serializers.UUIDField()
    parent_id = serializers.UUIDField(allow_null=True)
    body = serializers.CharField()
    author = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()


class SummaryOutputSerializer(serializers.Serializer):
    post_id = serializers.UUIDField()
    points = serializers.ListField(child=serializers.CharField())
    comment_count = serializers.IntegerField()
    updated_at = serializers.DateTimeField(allow_null=True)


def present_comments(comments) -> list[dict]:
    comments = list(comments)
    authors = profile_selectors.author_cards(user_ids={c.author_id for c in comments})
    return [
        {
            "id": comment.id,
            "post_id": comment.post_id,
            "parent_id": comment.parent_id,
            "body": comment.body,
            "author": authors.get(comment.author_id),
            "created_at": comment.created_at,
        }
        for comment in comments
    ]
