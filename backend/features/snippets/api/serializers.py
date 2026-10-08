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
    author = AuthorSerializer(allow_null=True)


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
