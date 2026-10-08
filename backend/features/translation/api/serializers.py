from rest_framework import serializers

from core.serializers import ReadOnlyModelSerializer

from ..models import Translation


class TranslationInputSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=8000)
    target_language = serializers.ChoiceField(choices=Translation.Language.choices)
    mode = serializers.ChoiceField(
        choices=Translation.Mode.choices, default=Translation.Mode.TRANSLATE
    )


class TranslationOutputSerializer(ReadOnlyModelSerializer):
    class Meta:
        model = Translation
        fields = ["id", "target_language", "mode", "status", "result", "created_at"]
