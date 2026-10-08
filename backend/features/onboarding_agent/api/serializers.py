from rest_framework import serializers

from core.serializers import ReadOnlyModelSerializer

from ..models import OnboardingGuide


class GuideRequestSerializer(serializers.Serializer):
    repo_url = serializers.URLField()
    project_id = serializers.UUIDField(required=False, allow_null=True)


class GuideSerializer(ReadOnlyModelSerializer):
    class Meta:
        model = OnboardingGuide
        fields = [
            "id",
            "repo_url",
            "project_id",
            "commit_sha",
            "status",
            "content",
            "error",
            "created_at",
            "updated_at",
        ]
