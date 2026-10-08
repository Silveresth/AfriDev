from rest_framework import serializers

from core.serializers import AuthorSerializer, ReadOnlyModelSerializer

from ..models import Report


class ReportInputSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=Report.TargetType.choices)
    target_id = serializers.UUIDField()
    reason = serializers.ChoiceField(choices=Report.Reason.choices)
    details = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class ReportOutputSerializer(ReadOnlyModelSerializer):
    reporter_id = serializers.UUIDField(allow_null=True)

    class Meta:
        model = Report
        fields = [
            "id",
            "reporter_id",
            "target_type",
            "target_id",
            "reason",
            "details",
            "status",
            "ai_verdict",
            "resolved_at",
            "created_at",
        ]


class AiVerdictSerializer(serializers.Serializer):
    violates = serializers.BooleanField()
    category = serializers.CharField()
    confidence = serializers.FloatField()
    explanation = serializers.CharField()


class ReportedContentSerializer(serializers.Serializer):
    text = serializers.CharField()
    url = serializers.CharField()
    hidden = serializers.BooleanField()
    author = AuthorSerializer(allow_null=True)


class ModerationReportSerializer(ReportOutputSerializer):
    """Vue de l'équipe de modération : contenu signalé (même masqué) et personnes concernées.
    Le contexte vient de selectors.queue_context (passé dans context["queue"])."""

    ai_verdict = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    reporter = serializers.SerializerMethodField()
    resolved_by = serializers.SerializerMethodField()
    report_count = serializers.SerializerMethodField()

    class Meta(ReportOutputSerializer.Meta):
        fields = [
            *ReportOutputSerializer.Meta.fields,
            "content",
            "reporter",
            "resolved_by",
            "report_count",
        ]

    def _extra(self, report) -> dict:
        return self.context["queue"].get(report.id, {})

    def get_ai_verdict(self, report) -> AiVerdictSerializer(allow_null=True):
        verdict = report.ai_verdict or {}
        return verdict if "violates" in verdict else None

    def get_content(self, report) -> ReportedContentSerializer(allow_null=True):
        return self._extra(report).get("content")

    def get_reporter(self, report) -> AuthorSerializer(allow_null=True):
        return self._extra(report).get("reporter")

    def get_resolved_by(self, report) -> AuthorSerializer(allow_null=True):
        return self._extra(report).get("resolved_by")

    def get_report_count(self, report) -> int:
        return self._extra(report).get("report_count", 1)


class ResolveInputSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["hide", "dismiss", "restore"])
