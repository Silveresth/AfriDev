from rest_framework import serializers

from ..models import MediaAsset


class MediaUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=MediaAsset.Kind.choices)
    file = serializers.FileField()


class PresignUploadInputSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=MediaAsset.Kind.choices)
    mime_type = serializers.CharField(max_length=100)
    size_bytes = serializers.IntegerField(min_value=1)
    filename = serializers.CharField(max_length=200, required=False, default="")


class UploadInstructionSerializer(serializers.Serializer):
    method = serializers.CharField()
    url = serializers.CharField()
    headers = serializers.DictField(child=serializers.CharField())


class PresignUploadOutputSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()
    upload = UploadInstructionSerializer()
    expires_in = serializers.IntegerField()


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
