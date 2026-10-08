from rest_framework import serializers

from ..models import Document


class SearchHitSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=Document.SourceType.choices)
    source_id = serializers.UUIDField()
    title = serializers.CharField()
    url = serializers.CharField()
    excerpt = serializers.CharField()
    score = serializers.FloatField()
