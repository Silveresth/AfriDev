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
    is_creator = serializers.BooleanField(default=False)
    role = serializers.CharField(allow_null=True, help_text="member, moderator ou null")
    can_manage = serializers.BooleanField(
        default=False, help_text="Créateur, modérateur ou staff : gère les membres du hub."
    )


class HubModeratorActionSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)


class HubMemberSerializer(serializers.Serializer):
    user = AuthorSerializer()
    role = serializers.ChoiceField(choices=["member", "moderator"])
    is_creator = serializers.BooleanField()
    joined_at = serializers.DateTimeField()


class HubBanSerializer(serializers.Serializer):
    user = AuthorSerializer()
    reason = serializers.CharField()
    banned_at = serializers.DateTimeField()


class HubMemberRemoveSerializer(serializers.Serializer):
    ban = serializers.BooleanField(default=False, help_text="Exclure : empêche de revenir.")
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


def present_members(memberships, *, hub) -> list[dict]:
    memberships = list(memberships)
    cards = profile_selectors.author_cards(user_ids={m.user_id for m in memberships})
    return [
        {
            "user": cards[m.user_id],
            "role": m.role,
            "is_creator": m.user_id == hub.creator_id,
            "joined_at": m.created_at,
        }
        for m in memberships
        if m.user_id in cards
    ]


def present_bans(bans) -> list[dict]:
    bans = list(bans)
    cards = profile_selectors.author_cards(user_ids={b.user_id for b in bans})
    return [
        {"user": cards[b.user_id], "reason": b.reason, "banned_at": b.created_at}
        for b in bans
        if b.user_id in cards
    ]


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
    managed = selectors.moderated_hub_ids(hub_ids={hub.id for hub in hubs}, user=viewer)
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
                {
                    "is_member": hub.id in roles,
                    "is_creator": bool(
                        viewer
                        and (hub.creator_id == viewer.id or getattr(viewer, "is_staff", False))
                    ),
                    "role": roles.get(hub.id),
                    "can_manage": hub.id in managed,
                }
                if authenticated
                else None
            ),
            "created_at": hub.created_at,
        }
        for hub in hubs
    ]
