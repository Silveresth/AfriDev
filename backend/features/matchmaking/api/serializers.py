from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import AuthorSerializer, ReadOnlyModelSerializer
from features.profiles import selectors as profile_selectors

from ..models import ProjectApplication


class ProjectSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    repo_url = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField())
    stars = serializers.IntegerField()


class ProjectRecommendationSerializer(serializers.Serializer):
    project = ProjectSummarySerializer()
    score = serializers.FloatField()
    matched = serializers.ListField(child=serializers.CharField())


class CandidateSerializer(AuthorSerializer):
    open_to_work = serializers.BooleanField()


class CandidateRecommendationSerializer(serializers.Serializer):
    candidate = CandidateSerializer()
    score = serializers.FloatField()
    matched = serializers.ListField(child=serializers.CharField())


class ApplyInputSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class ApplicationAnswerInputSerializer(serializers.Serializer):
    accept = serializers.BooleanField()


class ApplicationSerializer(ReadOnlyModelSerializer):
    candidate_id = serializers.UUIDField()
    candidate = serializers.SerializerMethodField()

    class Meta:
        model = ProjectApplication
        fields = [
            "id",
            "project_id",
            "candidate_id",
            "candidate",
            "message",
            "status",
            "created_at",
        ]

    @extend_schema_field(AuthorSerializer(allow_null=True))
    def get_candidate(self, application):
        cards = profile_selectors.author_cards(user_ids=[application.candidate_id])
        return cards.get(application.candidate_id)


def project_summary(project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "repo_url": project.repo_url,
        "tags": project.tags,
        "stars": project.stars,
    }


def candidate_card(profile) -> dict:
    return {
        "id": profile.user_id,
        "username": profile.username,
        "display_name": profile.display_name or profile.username,
        "avatar_url": profile.avatar_url,
        "location": profile.location,
        "stack": profile.stack,
        "karma": profile.karma_score,
        "badges": [{"code": b["code"], "label": b["label"]} for b in profile.badges[:2]],
        "open_to_work": profile.open_to_work,
    }
