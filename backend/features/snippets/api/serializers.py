from rest_framework import serializers

from core.serializers import (
    AuthorSerializer,
    HubSummarySerializer,
    ReadOnlyModelSerializer,
    string_list,
)

from ..models import Snippet, SnippetVersion


class SnippetInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    title = serializers.CharField(max_length=120)
    language = serializers.CharField(max_length=40)
    content = serializers.CharField(max_length=50000, trim_whitespace=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    is_public = serializers.BooleanField(required=False, default=False)
    hub_id = serializers.UUIDField(required=False, allow_null=True, help_text="Hub facultatif.")


class SnippetUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, required=False)
    language = serializers.CharField(max_length=40, required=False)
    content = serializers.CharField(max_length=50000, trim_whitespace=False, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    hub_id = serializers.UUIDField(required=False, allow_null=True)


class SnippetOutputSerializer(ReadOnlyModelSerializer):
    tags = string_list()

    class Meta:
        model = Snippet
        fields = [
            "id",
            "title",
            "language",
            "content",
            "tags",
            "is_public",
            "hub_id",
            "published_at",
            "ai_review",
            "comment_count",
            "created_at",
            "updated_at",
        ]


class PublicSnippetSerializer(serializers.Serializer):
    """Forme lue par la page publique /snippets/<id> (rendu serveur)."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    language = serializers.CharField()
    content = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField())
    hub = HubSummarySerializer(allow_null=True)
    published_at = serializers.DateTimeField()
    comment_count = serializers.IntegerField(default=0)
    author = AuthorSerializer(allow_null=True)
    author_role = serializers.CharField(
        allow_null=True,
        required=False,
        help_text="Rôle de l'auteur dans le hub : 'creator', 'moderator' ou null.",
    )
    can_moderate = serializers.BooleanField(
        default=False, help_text="Vrai si le visiteur modère le hub du snippet (ou est staff)."
    )


class SnippetVersionSerializer(ReadOnlyModelSerializer):
    class Meta:
        model = SnippetVersion
        fields = ["number", "content", "created_at"]


class ScanInputSerializer(serializers.Serializer):
    content = serializers.CharField(trim_whitespace=False)


class SecretFindingSerializer(serializers.Serializer):
    rule_id = serializers.CharField()
    description = serializers.CharField()
    line = serializers.IntegerField()


class SnippetCommentInputSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True)
    parent_id = serializers.UUIDField(required=False, allow_null=True)


class SnippetCommentSerializer(serializers.Serializer):
    """Commentaire public avec auteur enrichi."""

    id = serializers.UUIDField()
    body = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    parent_id = serializers.UUIDField(allow_null=True)
    author = AuthorSerializer(allow_null=True)
    score = serializers.IntegerField(default=0)
    viewer_vote = serializers.IntegerField(default=0, help_text="Vote du visiteur : -1, 0 ou 1.")
