from rest_framework import serializers

from core.serializers import AuthorSerializer, ReadOnlyModelSerializer, string_list
from features.profiles import selectors as profile_selectors

from .. import selectors
from ..models import Issue


class ProjectInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    repo_url = serializers.URLField(required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    is_recruiting = serializers.BooleanField(required=False, default=True)


class ProjectUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False)
    description = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    repo_url = serializers.URLField(required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    is_recruiting = serializers.BooleanField(required=False)


class ProjectOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    repo_url = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField())
    is_recruiting = serializers.BooleanField()
    stars = serializers.IntegerField()
    language = serializers.CharField()
    open_issue_count = serializers.IntegerField()
    last_synced_at = serializers.DateTimeField(allow_null=True)
    owner = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class IssueSerializer(ReadOnlyModelSerializer):
    project_id = serializers.UUIDField()
    labels = string_list()

    class Meta:
        model = Issue
        fields = ["id", "project_id", "number", "title", "url", "labels", "is_open"]


def present_projects(projects) -> list[dict]:
    projects = list(projects)
    owners = profile_selectors.author_cards(user_ids={p.owner_id for p in projects})
    counts = selectors.open_issue_counts(project_ids=[p.id for p in projects])
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "repo_url": p.repo_url,
            "tags": p.tags,
            "is_recruiting": p.is_recruiting,
            "stars": p.stars,
            "language": p.language,
            "open_issue_count": counts.get(p.id, 0),
            "last_synced_at": p.last_synced_at,
            "owner": owners.get(p.owner_id),
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in projects
    ]
