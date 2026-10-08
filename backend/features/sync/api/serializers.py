from rest_framework import serializers

from core.serializers import ReadOnlyModelSerializer

from ..models import SyncRejection


class PowerSyncTokenSerializer(serializers.Serializer):
    token = serializers.CharField()
    expires_at = serializers.DateTimeField()


class CrudOperationSerializer(serializers.Serializer):
    """Une entrée de la file locale (CrudEntry.toJSON() de PowerSync)."""

    op_id = serializers.IntegerField(required=False)
    op = serializers.ChoiceField(choices=["PUT", "PATCH", "DELETE"])
    type = serializers.CharField(max_length=40)
    id = serializers.CharField(max_length=64)
    tx_id = serializers.IntegerField(required=False, allow_null=True)
    data = serializers.DictField(required=False, allow_null=True)


class UploadInputSerializer(serializers.Serializer):
    operations = CrudOperationSerializer(many=True)


class RejectedOperationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    op_id = serializers.IntegerField(allow_null=True)
    table = serializers.CharField()
    record_id = serializers.CharField()
    code = serializers.CharField()
    message = serializers.CharField()


class UploadOutputSerializer(serializers.Serializer):
    applied = serializers.IntegerField()
    rejected = RejectedOperationSerializer(many=True)


class SyncRejectionSerializer(ReadOnlyModelSerializer):
    class Meta:
        model = SyncRejection
        fields = [
            "id",
            "op_id",
            "table",
            "record_id",
            "op",
            "data",
            "code",
            "message",
            "created_at",
        ]


class AcknowledgeInputSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), max_length=200)
