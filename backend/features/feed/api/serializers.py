from rest_framework import serializers

from core.serializers import AuthorSerializer, HubSummarySerializer
from features.hubs import selectors as hub_selectors
from features.media import selectors as media_selectors
from features.profiles import selectors as profile_selectors

from .. import selectors
from ..models import Post


class PostInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    kind = serializers.ChoiceField(choices=Post.Kind.choices, default=Post.Kind.TEXT)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    body = serializers.CharField(max_length=3000, required=False, allow_blank=True, default="")
    poll_options = serializers.ListField(
        child=serializers.CharField(max_length=80), required=False, max_length=4
    )
    media_id = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    hub_id = serializers.UUIDField(required=False, allow_null=True, help_text="Hub facultatif.")


class PostUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    body = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    hub_id = serializers.UUIDField(required=False, allow_null=True)


class ViewerStateSerializer(serializers.Serializer):
    post_vote = serializers.IntegerField(help_text="Vote du membre sur le post : -1, 0 ou 1.")
    liked = serializers.BooleanField(help_text="Obsolète : équivaut à post_vote == 1.")
    vote = serializers.IntegerField(allow_null=True, help_text="Choix du sondage.")


class PostOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=Post.Kind.choices)
    title = serializers.CharField()
    body = serializers.CharField()
    poll_options = serializers.ListField(child=serializers.CharField())
    poll_results = serializers.ListField(child=serializers.IntegerField(), allow_null=True)
    media_id = serializers.UUIDField(allow_null=True)
    media = serializers.JSONField(allow_null=True)
    tags = serializers.ListField(child=serializers.CharField())
    hub = HubSummarySerializer(allow_null=True)
    score = serializers.IntegerField()
    like_count = serializers.IntegerField()
    comment_count = serializers.IntegerField()
    author = AuthorSerializer(allow_null=True)
    viewer = ViewerStateSerializer(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class PollVoteInputSerializer(serializers.Serializer):
    option = serializers.IntegerField(min_value=0, max_value=3)


class LikeInputSerializer(serializers.Serializer):
    liked = serializers.BooleanField()


class VoteInputSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=[-1, 0, 1], help_text="1 = ↑, -1 = ↓, 0 = retrait.")


def present_posts(posts, *, viewer) -> list[dict]:
    """Assemble auteurs, médias et résultats de sondage en un minimum de requêtes."""
    posts = list(posts)
    ids = [post.id for post in posts]
    authors = profile_selectors.author_cards(user_ids={post.author_id for post in posts})
    media = media_selectors.describe_many(asset_ids={post.media_id for post in posts})
    polls = selectors.poll_results(post_ids=[p.id for p in posts if p.kind == Post.Kind.POLL])
    states = selectors.viewer_state(post_ids=ids, user=viewer)
    hubs = hub_selectors.hub_cards(hub_ids={post.hub_id for post in posts})

    return [
        {
            "id": post.id,
            "kind": post.kind,
            "title": post.title,
            "body": post.body,
            "poll_options": post.poll_options,
            "poll_results": (
                [polls.get(post.id, {}).get(i, 0) for i in range(len(post.poll_options))]
                if post.kind == Post.Kind.POLL
                else None
            ),
            "media_id": post.media_id,
            "media": media.get(post.media_id),
            "tags": post.tags,
            "hub": hubs.get(post.hub_id),
            "score": post.score,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "author": authors.get(post.author_id),
            "viewer": states.get(post.id),
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }
        for post in posts
    ]


class CommunitySerializer(serializers.Serializer):
    """Communauté = tag actif, avec le nombre de posts et de questions récents."""

    tag = serializers.CharField()
    posts = serializers.IntegerField()
    questions = serializers.IntegerField()


class NewsItemSerializer(serializers.Serializer):
    """Article externe (Hacker News, DEV.to, média tech) : titre, extrait et lien seulement."""

    id = serializers.CharField()
    source = serializers.ChoiceField(choices=["hackernews", "devto", "rss"])
    source_name = serializers.CharField()
    title = serializers.CharField()
    url = serializers.URLField()
    excerpt = serializers.CharField(allow_blank=True)
    author = serializers.CharField(allow_blank=True)
    image_url = serializers.CharField(allow_blank=True)
    lang = serializers.CharField()
    score = serializers.IntegerField(allow_null=True)
    comment_count = serializers.IntegerField(allow_null=True)
    discussion_url = serializers.CharField(allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField())
    published_at = serializers.DateTimeField(allow_null=True)
