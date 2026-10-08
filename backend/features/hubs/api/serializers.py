from rest_framework import serializers

from core.serializers import AuthorSerializer
from features.profiles import selectors as profile_selectors

from .. import selectors


class HubInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    slug = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    icon = serializers.CharField(max_length=300, required=False, allow_blank=True)
    banner_url = serializers.URLField(required=False, allow_blank=True)
    rules = serializers.ListField(
        child=serializers.CharField(max_length=200, allow_blank=True), required=False, max_length=10
    )
    target_country = serializers.CharField(max_length=60, required=False, allow_blank=True)


class HubUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60, required=False)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    icon = serializers.CharField(max_length=300, required=False, allow_blank=True)
    banner_url = serializers.URLField(required=False, allow_blank=True)
    rules = serializers.ListField(
        child=serializers.CharField(max_length=200, allow_blank=True), required=False, max_length=10
    )
    target_country = serializers.CharField(max_length=60, required=False, allow_blank=True)


class HubViewerSerializer(serializers.Serializer):
    is_member = serializers.BooleanField()
    role = serializers.CharField(allow_null=True, help_text="member, moderator ou null")


class HubOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    icon = serializers.CharField()
    banner_url = serializers.CharField()
    rules = serializers.ListField(child=serializers.CharField())
    target_country = serializers.CharField()
    is_verified = serializers.BooleanField()
    member_count = serializers.IntegerField()
    creator = AuthorSerializer(allow_null=True)
    moderators = AuthorSerializer(many=True)
    viewer = HubViewerSerializer(allow_null=True)
    created_at = serializers.DateTimeField()


def present_hubs(hubs, *, viewer, detail: bool = False) -> list[dict]:
    hubs = list(hubs)
    roles = selectors.viewer_roles(hub_ids=[hub.id for hub in hubs], user=viewer)
    moderators = (
        {hub.id: selectors.list_moderators(hub_id=hub.id) for hub in hubs} if detail else {}
    )
    people = {hub.creator_id for hub in hubs} | {
        user_id for ids in moderators.values() for user_id in ids
    }
    cards = profile_selectors.author_cards(user_ids=people)
    authenticated = bool(viewer and viewer.is_authenticated)
    return [
        {
            "id": hub.id,
            "slug": hub.slug,
            "name": hub.name,
            "description": hub.description,
            "icon": hub.icon,
            "banner_url": hub.banner_url,
            "rules": hub.rules,
            "target_country": hub.target_country,
            "is_verified": hub.is_verified,
            "member_count": hub.member_count,
            "creator": cards.get(hub.creator_id),
            "moderators": [cards[uid] for uid in moderators.get(hub.id, []) if uid in cards],
            "viewer": (
                {"is_member": hub.id in roles, "role": roles.get(hub.id)} if authenticated else None
            ),
            "created_at": hub.created_at,
        }
        for hub in hubs
    ]
