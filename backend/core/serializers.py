"""Formes de réponse partagées (documentation OpenAPI)."""

from rest_framework import serializers


class BadgeSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()


class AuthorSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_blank=True)
    # Pays / ville et spécialités affichés en badge à côté du nom sur les cartes.
    location = serializers.CharField(allow_blank=True)
    stack = serializers.ListField(child=serializers.CharField())
    # Réputation affichée sous l'avatar (cartes de posts, réponses).
    karma = serializers.IntegerField()
    badges = BadgeSerializer(many=True)


class HubSummarySerializer(serializers.Serializer):
    """Hub (h/<slug>) auquel un post, une question ou un snippet est rattaché."""

    id = serializers.UUIDField()
    slug = serializers.CharField()
    name = serializers.CharField()
    icon = serializers.CharField(allow_blank=True)
    is_verified = serializers.BooleanField()


class AcceptedJobSerializer(serializers.Serializer):
    job_id = serializers.UUIDField()


class ReadOnlyModelSerializer(serializers.ModelSerializer):
    """Sérialiseur de sortie : tous les champs en lecture seule.

    L'OpenAPI les marque alors « requis », et les types générés pour le web et le mobile
    n'ont pas de champs faussement optionnels.
    """

    def get_fields(self):
        fields = super().get_fields()
        for field in fields.values():
            field.read_only = True
            field.required = False
        return fields


def string_list():
    """Liste de chaînes stockée en JSON (tags, stack, labels) : typée explicitement."""
    return serializers.ListField(child=serializers.CharField(), read_only=True)
