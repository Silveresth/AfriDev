from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import AuthorSerializer, ReadOnlyModelSerializer, string_list

from .. import selectors, services
from ..models import PROFILE_COLORS, WORK_PREFERENCES, Profile

PIN_TYPES = [(kind, kind) for kind in services.PINNABLE]
PIN_HREFS = {
    "post": "/feed/{}",
    "question": "/questions/{}",
    "snippet": "/snippets/{}",
    "project": "/projects/{}",
}


class PinnedItemSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=PIN_TYPES)
    target_id = serializers.UUIDField()
    title = serializers.CharField()
    excerpt = serializers.CharField()
    href = serializers.CharField()
    language = serializers.CharField(allow_null=True)


def present_pinned(profile, *, viewer=None) -> list[dict]:
    viewer_id = viewer.id if viewer and viewer.is_authenticated else None
    summaries = services.pinned_summaries(profile.pinned, viewer_id=viewer_id)
    rows = []
    for item in profile.pinned:
        summary = summaries.get((item["target_type"], str(item["target_id"])))
        if summary is None:
            continue  # supprimé ou redevenu privé : simplement masqué
        rows.append(
            {
                "target_type": item["target_type"],
                "target_id": item["target_id"],
                "title": summary["title"],
                "excerpt": summary["excerpt"],
                "href": PIN_HREFS[item["target_type"]].format(item["target_id"]),
                "language": summary.get("language"),
            }
        )
    return rows


class ProfileBadgeSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    description = serializers.CharField()
    awarded_at = serializers.DateTimeField()


class KarmaDetailsSerializer(serializers.Serializer):
    upvotes = serializers.IntegerField(default=0)
    accepted_answers = serializers.IntegerField(default=0)
    snippet_saves = serializers.IntegerField(default=0)


class PublicProfileSerializer(ReadOnlyModelSerializer):
    """Forme lue par la page publique /u/<username> (cible du QR code)."""

    stack = string_list()
    karma_details = KarmaDetailsSerializer(read_only=True)
    badges = ProfileBadgeSerializer(many=True, read_only=True)
    work_preferences = string_list()
    pinned = serializers.SerializerMethodField()

    @extend_schema_field(PinnedItemSerializer(many=True))
    def get_pinned(self, profile) -> list[dict]:
        request = self.context.get("request")
        return present_pinned(profile, viewer=getattr(request, "user", None))

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "display_name",
            "bio",
            "avatar_url",
            "stack",
            "github_username",
            "location",
            "website",
            "open_to_work",
            "accent_color",
            "work_preferences",
            "daily_rate",
            "availability_note",
            "pinned",
            "karma_score",
            "karma_details",
            "badges",
            "created_at",
        ]


class MyProfileSerializer(PublicProfileSerializer):
    class Meta:
        model = Profile
        fields = PublicProfileSerializer.Meta.fields + [
            "ai_bio_suggestion",
            "ai_bio_status",
            "updated_at",
        ]


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    bio = serializers.CharField(max_length=600, required=False, allow_blank=True)
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    stack = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=20
    )
    github_username = serializers.RegexField(
        r"^[A-Za-z0-9-]{0,39}$", required=False, allow_blank=True
    )
    location = serializers.CharField(max_length=80, required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)
    open_to_work = serializers.BooleanField(required=False)
    accent_color = serializers.ChoiceField(choices=PROFILE_COLORS, required=False, allow_blank=True)
    work_preferences = serializers.ListField(
        child=serializers.ChoiceField(choices=list(WORK_PREFERENCES.items())),
        required=False,
        max_length=len(WORK_PREFERENCES),
    )
    daily_rate = serializers.CharField(max_length=40, required=False, allow_blank=True)
    availability_note = serializers.CharField(max_length=200, required=False, allow_blank=True)


class PinInputSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=PIN_TYPES)
    target_id = serializers.UUIDField()


class PinnedInputSerializer(serializers.Serializer):
    items = PinInputSerializer(many=True, max_length=services.MAX_PINNED)


class EndorsementInputSerializer(serializers.Serializer):
    skill = serializers.CharField(max_length=30)


class EndorsementSerializer(serializers.Serializer):
    skill = serializers.CharField()
    count = serializers.IntegerField()
    endorsers = AuthorSerializer(many=True, help_text="Les premiers pairs à l'avoir endossé.")
    endorsed_by_me = serializers.BooleanField()


def present_endorsements(profile, *, viewer) -> list[dict]:
    rows = selectors.endorsements(profile=profile, viewer=viewer)
    cards = selectors.author_cards(user_ids={uid for row in rows for uid in row["endorser_ids"]})
    return [
        {
            "skill": row["skill"],
            "count": row["count"],
            "endorsers": [cards[uid] for uid in row["endorser_ids"] if uid in cards],
            "endorsed_by_me": row["endorsed_by_me"],
        }
        for row in rows
    ]


class GitHubLanguageSerializer(serializers.Serializer):
    name = serializers.CharField()
    repos = serializers.IntegerField()


class GitHubRepoSerializer(serializers.Serializer):
    name = serializers.CharField()
    url = serializers.CharField()
    description = serializers.CharField()
    language = serializers.CharField()
    stars = serializers.IntegerField()


class GitHubOverviewSerializer(serializers.Serializer):
    login = serializers.CharField()
    html_url = serializers.CharField()
    public_repos = serializers.IntegerField()
    followers = serializers.IntegerField()
    total_stars = serializers.IntegerField()
    top_languages = GitHubLanguageSerializer(many=True)
    top_repos = GitHubRepoSerializer(many=True)
