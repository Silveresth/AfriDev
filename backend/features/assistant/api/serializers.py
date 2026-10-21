from rest_framework import serializers


class JobAcceptedSerializer(serializers.Serializer):
    job_id = serializers.CharField(help_text="Suivre le résultat via GET /api/jobs/<job_id>/.")


class JobMatchInputSerializer(serializers.Serializer):
    job_id = serializers.UUIDField(help_text="Offre d'emploi à évaluer.")


class CodeReviewInputSerializer(serializers.Serializer):
    snippet_id = serializers.UUIDField(required=False, allow_null=True)
    code = serializers.CharField(required=False, allow_blank=True, max_length=12_000, default="")
    language = serializers.CharField(required=False, allow_blank=True, max_length=40, default="")


class ChatRepliesInputSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField()


class DigestItemSerializer(serializers.Serializer):
    emoji = serializers.CharField()
    text = serializers.CharField()
    url = serializers.CharField(allow_null=True)


class DigestSerializer(serializers.Serializer):
    headline = serializers.CharField()
    items = DigestItemSerializer(many=True)


class DigestResponseSerializer(serializers.Serializer):
    digest = DigestSerializer(
        allow_null=True, help_text="null : en préparation, ou rien à signaler."
    )
    job_id = serializers.CharField(allow_null=True, help_text="En préparation : suivre ce job.")


class TeamInputSerializer(serializers.Serializer):
    project_id = serializers.UUIDField()


class TeamInviteInputSerializer(serializers.Serializer):
    project_id = serializers.UUIDField()
    username = serializers.CharField(max_length=30)
    message = serializers.CharField(max_length=1500, allow_blank=True, required=False, default="")


class AskTurnSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=4000)


class AskInputSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=1000)
    history = AskTurnSerializer(
        many=True, required=False, default=list, help_text="Échanges précédents (6 au plus)."
    )


class HubSuggestInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=3000, required=False, allow_blank=True, default="")
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, default=list, max_length=8
    )


class VoiceSearchInputSerializer(serializers.Serializer):
    media_id = serializers.UUIDField(help_text="Enregistrement audio déjà envoyé (/api/media/).")
    language = serializers.CharField(required=False, allow_null=True, max_length=5)
