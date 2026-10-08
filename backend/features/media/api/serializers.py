from rest_framework import serializers

from ..models import MediaAsset


class MediaUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=MediaAsset.Kind.choices)
    file = serializers.FileField()


class MediaOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=MediaAsset.Kind.choices)
    status = serializers.ChoiceField(choices=MediaAsset.Status.choices)
    width = serializers.IntegerField(allow_null=True)
    height = serializers.IntegerField(allow_null=True)
    duration_seconds = serializers.FloatField(allow_null=True)
    thumbhash = serializers.CharField()
    original_url = serializers.CharField()
    urls = serializers.DictField(child=serializers.CharField())
