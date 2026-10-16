from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import AuthorSerializer, ReadOnlyModelSerializer, string_list

from .. import preferences, selectors, services
from ..models import PROFILE_COLORS, SOCIAL_NETWORKS, WORK_PREFERENCES, Profile

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
    """Ancien format (déprécié) : préférer `craft`."""

    upvotes = serializers.IntegerField(default=0)
    accepted_answers = serializers.IntegerField(default=0)
    snippet_saves = serializers.IntegerField(default=0)


class CraftGaugeSerializer(serializers.Serializer):
    score = serializers.IntegerField()
    # Compteurs à l'origine des points de la jauge.
    breakdown = serializers.DictField(child=serializers.IntegerField())


class CraftSerializer(serializers.Serializer):
    """Craft Score global et ses deux jauges (infobulle Entraide vs Création)."""

    score = serializers.IntegerField()
    help = CraftGaugeSerializer(help_text="Entraide : votes ↑ sur réponses, réponses acceptées.")
    creation = CraftGaugeSerializer(help_text="Création : votes ↑ sur posts, favoris de snippets.")
    project_stars = serializers.IntegerField()


def present_craft(profile) -> dict:
    details = profile.karma_details or {}
    return {
        "score": profile.karma_score,
        "help": {
            "score": profile.craft_help,
            "breakdown": {
                "answer_upvotes": details.get("answer_upvotes", 0),
                "accepted_answers": details.get("accepted_answers", 0),
            },
        },
        "creation": {
            "score": profile.craft_creation,
            "breakdown": {
                "post_upvotes": details.get("post_upvotes", 0),
                "snippet_saves": details.get("snippet_saves", 0),
            },
        },
        "project_stars": details.get("project_stars", 0),
    }


class SocialLinksSerializer(serializers.Serializer):
    """Liens publics par réseau ; seuls les réseaux renseignés sont présents."""

    github = serializers.URLField(required=False)
    gitlab = serializers.URLField(required=False)
    linkedin = serializers.URLField(required=False)
    twitter = serializers.URLField(required=False)
    tiktok = serializers.URLField(required=False)
    instagram = serializers.URLField(required=False)
    youtube = serializers.URLField(required=False)
    facebook = serializers.URLField(required=False)
    dev = serializers.URLField(required=False)
    medium = serializers.URLField(required=False)
    portfolio = serializers.URLField(required=False)


def _viewer(serializer):
    user = getattr(serializer.context.get("request"), "user", None)
    return user if user is not None and user.is_authenticated else None


class PublicProfileSerializer(ReadOnlyModelSerializer):
    """Forme lue par la page publique /u/<username> (cible du QR code)."""

    stack = string_list()
    karma_details = KarmaDetailsSerializer(read_only=True)
    badges = ProfileBadgeSerializer(many=True, read_only=True)
    work_preferences = string_list()
    social_links = SocialLinksSerializer(read_only=True)
    pinned = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    craft_score = serializers.IntegerField(source="karma_score", read_only=True)
    craft = serializers.SerializerMethodField()

    @extend_schema_field(CraftSerializer)
    def get_craft(self, profile) -> dict:
        return present_craft(profile)

    @extend_schema_field(PinnedItemSerializer(many=True))
    def get_pinned(self, profile) -> list[dict]:
        return present_pinned(profile, viewer=_viewer(self))

    def get_is_following(self, profile) -> bool:
        """Le visiteur connecté suit-il ce membre ? (faux pour soi-même et les anonymes)"""
        viewer = _viewer(self)
        return bool(viewer) and selectors.is_following(
            follower_id=viewer.id, followed_id=profile.user_id
        )

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "display_name",
            "bio",
            "avatar_url",
            "banner_url",
            "social_links",
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
            "craft_score",
            "craft",
            "karma_score",
            "karma_details",
            "badges",
            "followers_count",
            "following_count",
            "is_following",
            "created_at",
        ]


class MyProfileSerializer(PublicProfileSerializer):
    goals = string_list()
    interests = string_list()
    needs_onboarding = serializers.SerializerMethodField()
    feed_mix = serializers.SerializerMethodField()

    def get_needs_onboarding(self, profile) -> bool:
        """Vrai tant que l'accueil n'est ni terminé ni passé (affiché sur web et mobile)."""
        return profile.onboarded_at is None

    @extend_schema_field(serializers.DictField(child=serializers.IntegerField()))
    def get_feed_mix(self, profile) -> dict:
        """Part (%) de chaque type de contenu dans « Pour vous » : post, question, snippet…"""
        return preferences.feed_mix(goals=profile.goals, level=profile.experience_level)

    class Meta:
        model = Profile
        fields = PublicProfileSerializer.Meta.fields + [
            "experience_level",
            "goals",
            "interests",
            "onboarded_at",
            "needs_onboarding",
            "feed_mix",
            "ai_bio_suggestion",
            "ai_bio_status",
            "updated_at",
        ]


class ChoiceItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    label = serializers.CharField()


class WeightedChoiceSerializer(ChoiceItemSerializer):
    weights = serializers.DictField(
        child=serializers.IntegerField(), help_text="Poids ajoutés au fil par type de contenu."
    )


class TopicItemSerializer(ChoiceItemSerializer):
    suggest = serializers.ListField(child=serializers.CharField())


class CurrentPreferencesSerializer(serializers.Serializer):
    experience_level = serializers.CharField(allow_blank=True)
    goals = serializers.ListField(child=serializers.CharField())
    topics = serializers.ListField(child=serializers.CharField())
    stack = serializers.ListField(child=serializers.CharField())
    learning = serializers.ListField(child=serializers.CharField())


class OnboardingSerializer(serializers.Serializer):
    """Tout ce que l'écran d'accueil affiche : catalogue, choix actuels, stack GitHub détectée."""

    base_mix = serializers.DictField(child=serializers.IntegerField())
    levels = WeightedChoiceSerializer(many=True)
    goals = WeightedChoiceSerializer(many=True)
    topics = TopicItemSerializer(many=True)
    current = CurrentPreferencesSerializer()
    github_stack = serializers.ListField(
        child=serializers.CharField(), help_text="Technologies déduites des langages GitHub."
    )


def present_onboarding(profile) -> dict:
    topics = preferences.selected_topics(profile.interests)
    taken = set(profile.stack) | set(preferences.topics_to_tags(topics))
    return {
        **preferences.catalogue(),
        "current": {
            "experience_level": profile.experience_level,
            "goals": list(profile.goals),
            "topics": topics,
            "stack": list(profile.stack),
            "learning": [tag for tag in profile.interests if tag not in taken],
        },
        "github_stack": selectors.github_stack(profile=profile),
    }


class PreferencesInputSerializer(serializers.Serializer):
    experience_level = serializers.ChoiceField(
        choices=list(preferences.EXPERIENCE_LEVELS), required=False, allow_blank=True, default=""
    )
    goals = serializers.ListField(
        child=serializers.ChoiceField(choices=list(preferences.GOALS)),
        required=False,
        default=list,
        max_length=len(preferences.GOALS),
    )
    topics = serializers.ListField(
        child=serializers.ChoiceField(choices=list(preferences.TOPICS)),
        required=False,
        default=list,
        max_length=len(preferences.TOPICS),
    )
    stack = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, default=list, max_length=20
    )
    learning = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, default=list, max_length=20
    )


class SuggestedPersonSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_blank=True)
    craft_score = serializers.IntegerField()
    shared_stack = serializers.ListField(child=serializers.CharField())


class SuggestedHubSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.CharField()
    name = serializers.CharField()
    icon = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    member_count = serializers.IntegerField()
    is_verified = serializers.BooleanField()


class OnboardingSuggestionsSerializer(serializers.Serializer):
    people = SuggestedPersonSerializer(many=True)
    hubs = SuggestedHubSerializer(many=True)


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    bio = serializers.CharField(max_length=600, required=False, allow_blank=True)
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    banner_url = serializers.URLField(required=False, allow_blank=True)
    # Remplace tous les liens ; une valeur vide retire le réseau.
    social_links = serializers.DictField(
        child=serializers.CharField(max_length=200, allow_blank=True),
        required=False,
        help_text=f"Réseaux acceptés : {', '.join(SOCIAL_NETWORKS)}.",
    )
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


class FollowStateSerializer(serializers.Serializer):
    is_following = serializers.BooleanField()
    followers_count = serializers.IntegerField()
    following_count = serializers.IntegerField()


class FollowListItemSerializer(AuthorSerializer):
    followed_at = serializers.DateTimeField()
    is_following = serializers.BooleanField(help_text="Le visiteur connecté suit-il ce membre ?")


def present_follow_page(rows, *, user_field: str, viewer) -> list[dict]:
    """Cartes d'une page d'abonnés / abonnements : 2 requêtes, quelle que soit la taille."""
    user_ids = [getattr(row, user_field) for row in rows]
    cards = selectors.author_cards(user_ids=user_ids)
    mine = selectors.followed_ids(
        follower_id=viewer.id if viewer and viewer.is_authenticated else None, user_ids=user_ids
    )
    return [
        {**cards[uid], "followed_at": row.created_at, "is_following": uid in mine}
        for row, uid in zip(rows, user_ids, strict=True)
        if uid in cards
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
