"""Formes de réponse du back-office, décrites champ par champ pour les types TypeScript."""

from rest_framework import serializers

from core.serializers import AuthorSerializer

Counts = lambda: serializers.DictField(child=serializers.IntegerField())  # noqa: E731


class MemberStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    new = serializers.IntegerField()
    active = serializers.IntegerField(help_text="Connectés pendant la période.")
    staff = serializers.IntegerField()
    suspended = serializers.IntegerField()


class TotalNewSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    new = serializers.IntegerField()


class PostStatsSerializer(TotalNewSerializer):
    by_kind = Counts()


class QaStatsSerializer(serializers.Serializer):
    questions = serializers.IntegerField()
    new_questions = serializers.IntegerField()
    unanswered = serializers.IntegerField()
    resolved = serializers.IntegerField()
    answers = serializers.IntegerField()
    new_answers = serializers.IntegerField()
    ai_answers = Counts()


class SnippetStatsSerializer(TotalNewSerializer):
    public = serializers.IntegerField()
    flagged = serializers.IntegerField(help_text="Repassés en privé par le Security Guard (IA).")


class ProjectStatsSerializer(TotalNewSerializer):
    recruiting = serializers.IntegerField()
    sync_errors = serializers.IntegerField()


class ApplicationStatsSerializer(serializers.Serializer):
    new = serializers.IntegerField()
    by_status = Counts()


class ContentStatsSerializer(serializers.Serializer):
    posts = PostStatsSerializer()
    comments = TotalNewSerializer()
    qa = QaStatsSerializer()
    snippets = SnippetStatsSerializer()
    projects = ProjectStatsSerializer()
    applications = ApplicationStatsSerializer()


class ModerationStatsSerializer(serializers.Serializer):
    open = serializers.IntegerField()
    by_status = Counts()
    new = serializers.IntegerField()
    new_from_ai = serializers.IntegerField()
    by_reason = Counts()


class ModelUsageSerializer(serializers.Serializer):
    model = serializers.CharField()
    input = serializers.IntegerField()
    output = serializers.IntegerField()


class AiUsageSerializer(serializers.Serializer):
    input_tokens = serializers.IntegerField()
    output_tokens = serializers.IntegerField()
    by_model = ModelUsageSerializer(many=True)
    days_covered = serializers.IntegerField()


class GuideStatsSerializer(serializers.Serializer):
    new = serializers.IntegerField()
    failed = serializers.IntegerField()


class AiStatsSerializer(serializers.Serializer):
    answers = Counts()
    translations = serializers.IntegerField()
    guides = GuideStatsSerializer()
    usage = AiUsageSerializer()


class SyncStatsSerializer(serializers.Serializer):
    new = serializers.IntegerField()
    unacknowledged = serializers.IntegerField()


class TimelinePointSerializer(serializers.Serializer):
    day = serializers.DateField()
    signups = serializers.IntegerField()
    posts = serializers.IntegerField()
    comments = serializers.IntegerField()
    qa = serializers.IntegerField()


class UnansweredQuestionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    created_at = serializers.DateTimeField()
    author = AuthorSerializer(allow_null=True)


class DashboardSerializer(serializers.Serializer):
    period_days = serializers.IntegerField()
    generated_at = serializers.DateTimeField()
    members = MemberStatsSerializer()
    content = ContentStatsSerializer()
    moderation = ModerationStatsSerializer()
    ai = AiStatsSerializer()
    sync = SyncStatsSerializer()
    timeline = TimelinePointSerializer(many=True)
    unanswered_questions = UnansweredQuestionSerializer(many=True)


class MemberSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.CharField(allow_blank=True)
    phone_number = serializers.CharField(allow_null=True)
    display_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_blank=True)
    date_joined = serializers.DateTimeField()
    last_login = serializers.DateTimeField(allow_null=True)
    is_active = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()

    def to_representation(self, user):
        card = self.context["cards"].get(user.id) or {}
        return super().to_representation(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "phone_number": user.phone_number,
                "display_name": card.get("display_name") or user.username,
                "avatar_url": card.get("avatar_url", ""),
                "date_joined": user.date_joined,
                "last_login": user.last_login,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        )


class MemberUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    is_staff = serializers.BooleanField(required=False)
