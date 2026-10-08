from rest_framework import serializers

from core.serializers import ReadOnlyModelSerializer

from ..models import Notification


class NotificationSerializer(ReadOnlyModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "data", "read_at", "created_at"]


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField()


class DeviceInputSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=200)
    platform = serializers.ChoiceField(
        choices=["ios", "android", "web"], required=False, default=""
    )


class NotificationKindSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class PreferencesSerializer(serializers.Serializer):
    muted_kinds = serializers.ListField(child=serializers.CharField())
    push_enabled = serializers.BooleanField()
    email_enabled = serializers.BooleanField()
    kinds = NotificationKindSerializer(many=True, help_text="Types de notification réglables.")


class PreferencesUpdateSerializer(serializers.Serializer):
    muted_kinds = serializers.ListField(
        child=serializers.ChoiceField(choices=Notification.Kind.choices), required=False
    )
    push_enabled = serializers.BooleanField(required=False)
    email_enabled = serializers.BooleanField(required=False)


def present_preferences(preference) -> dict:
    return {
        "muted_kinds": preference.muted_kinds,
        "push_enabled": preference.push_enabled,
        "email_enabled": preference.email_enabled,
        "kinds": [{"value": value, "label": label} for value, label in Notification.Kind.choices],
    }
