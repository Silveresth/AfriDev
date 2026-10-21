from rest_framework import serializers

from core.serializers import AuthorSerializer, HubSummarySerializer
from features.discussions import selectors as discussion_selectors
from features.hubs import selectors as hub_selectors
from features.media import selectors as media_selectors
from features.profiles import selectors as profile_selectors
from features.reactions import selectors as reaction_selectors

from .. import selectors
from ..models import Post

REACTABLE = ("question", "snippet", "project", "job")
# Projets et offres : commentaires dans features.discussions (TargetComment).
COMMENTED_TARGETS = ("project", "job")


class PostInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    kind = serializers.ChoiceField(choices=Post.Kind.choices, default=Post.Kind.TEXT)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    body = serializers.CharField(max_length=3000, required=False, allow_blank=True, default="")
    poll_options = serializers.ListField(
        child=serializers.CharField(max_length=80), required=False, max_length=4
    )
    media_id = serializers.UUIDField(required=False, allow_null=True)
    link_url = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
        help_text="Ressource externe facultative (https://…) : la carte du post y mène.",
    )
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    hub_id = serializers.UUIDField(required=False, allow_null=True, help_text="Hub facultatif.")


class PostUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    body = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    link_url = serializers.CharField(
        max_length=500, required=False, allow_blank=True, help_text="Vide = retirer le lien."
    )
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    hub_id = serializers.UUIDField(required=False, allow_null=True)


class PostPinInputSerializer(serializers.Serializer):
    pinned = serializers.BooleanField(default=True)


class ViewerStateSerializer(serializers.Serializer):
    post_vote = serializers.IntegerField(help_text="Vote du membre sur le post : -1, 0 ou 1.")
    liked = serializers.BooleanField(help_text="Obsolète : équivaut à post_vote == 1.")
    vote = serializers.IntegerField(allow_null=True, help_text="Choix du sondage.")
    can_moderate = serializers.BooleanField(
        default=False,
        help_text="Vrai si le visiteur modère le hub du post (épingler, supprimer) ou est staff.",
    )


class PostLinkCardSerializer(serializers.Serializer):
    """Carte de la ressource d'un post (lue en tâche de fond : `pending` juste après la
    publication, `failed` si la page est injoignable)."""

    status = serializers.ChoiceField(choices=["pending", "ready", "failed"])
    kind = serializers.ChoiceField(choices=["article", "video"])
    title = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    image_url = serializers.CharField(allow_blank=True)
    site_name = serializers.CharField(allow_blank=True)
    domain = serializers.CharField(allow_blank=True)
    reading_minutes = serializers.IntegerField(allow_null=True)
    summary = serializers.ListField(child=serializers.CharField(), help_text="Résumé IA (≤ 3).")


class PostOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=Post.Kind.choices)
    title = serializers.CharField()
    body = serializers.CharField()
    poll_options = serializers.ListField(child=serializers.CharField())
    poll_results = serializers.ListField(child=serializers.IntegerField(), allow_null=True)
    media_id = serializers.UUIDField(allow_null=True)
    media = serializers.JSONField(allow_null=True)
    link_url = serializers.CharField(allow_blank=True, default="")
    link_preview = PostLinkCardSerializer(allow_null=True, required=False)
    tags = serializers.ListField(child=serializers.CharField())
    hub = HubSummarySerializer(allow_null=True)
    is_pinned = serializers.BooleanField(default=False)
    score = serializers.IntegerField()
    like_count = serializers.IntegerField()
    comment_count = serializers.IntegerField()
    author = AuthorSerializer(allow_null=True)
    author_role = serializers.CharField(
        allow_null=True,
        required=False,
        help_text="Rôle de l'auteur dans le hub : 'creator', 'moderator' ou null.",
    )
    viewer = ViewerStateSerializer(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class PollVoteInputSerializer(serializers.Serializer):
    option = serializers.IntegerField(min_value=0, max_value=3)


class LikeInputSerializer(serializers.Serializer):
    liked = serializers.BooleanField()


class VoteInputSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=[-1, 0, 1], help_text="1 = ↑, -1 = ↓, 0 = retrait.")


def present_posts(posts, *, viewer, authors: dict | None = None) -> list[dict]:
    """Assemble auteurs, médias et résultats de sondage en un minimum de requêtes.

    `authors` : cartes déjà chargées (fil d'accueil mixte), pour ne pas les relire.
    """
    posts = list(posts)
    ids = [post.id for post in posts]
    if authors is None:
        authors = profile_selectors.author_cards(user_ids={post.author_id for post in posts})
    media = media_selectors.describe_many(asset_ids={post.media_id for post in posts})
    previews = selectors.link_previews(urls={post.link_url for post in posts})
    polls = selectors.poll_results(post_ids=[p.id for p in posts if p.kind == Post.Kind.POLL])
    states = selectors.viewer_state(post_ids=ids, user=viewer)
    hubs = hub_selectors.hub_cards(hub_ids={post.hub_id for post in posts})
    author_roles = hub_selectors.author_hub_roles(
        pairs={(post.hub_id, post.author_id) for post in posts if post.hub_id}
    )
    moderated = hub_selectors.moderated_hub_ids(
        hub_ids={post.hub_id for post in posts}, user=viewer
    )

    results = []
    for post in posts:
        state = states.get(post.id)
        if state:
            # Droits de modération du hub (épingler, supprimer le post d'un autre) ; l'auteur
            # peut toujours supprimer son propre post, sans être modérateur.
            state["can_moderate"] = bool(
                getattr(viewer, "is_staff", False) or (post.hub_id and post.hub_id in moderated)
            )

        results.append(
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
                "link_url": post.link_url,
                "link_preview": previews.get(post.link_url),
                "tags": post.tags,
                "hub": hubs.get(post.hub_id),
                "is_pinned": post.is_pinned,
                "score": post.score,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "author": authors.get(post.author_id),
                "author_role": author_roles.get((post.hub_id, post.author_id)),
                "viewer": state,
                "created_at": post.created_at,
                "updated_at": post.updated_at,
            }
        )
    return results


class HomeCardSerializer(serializers.Serializer):
    """Question, snippet, projet ou offre, sous une forme commune pour le fil d'accueil."""

    title = serializers.CharField()
    excerpt = serializers.CharField(allow_blank=True)
    tags = serializers.ListField(child=serializers.CharField())
    url = serializers.CharField(help_text="Chemin de la page du contenu sur le site.")
    author = AuthorSerializer(allow_null=True)
    meta = serializers.DictField(
        help_text="question : is_resolved, answer_count · snippet : language, lines · "
        "project : stars, language, is_recruiting, repo_url · job : company, location, "
        "is_remote, contract_type, salary_range, apply_url"
    )


class HomeStatsSerializer(serializers.Serializer):
    """Compteurs et état du visiteur d'une carte (question, snippet, projet) : actions directes
    depuis le fil sans ouvrir le contenu."""

    score = serializers.IntegerField()
    viewer_vote = serializers.IntegerField(help_text="Vote du visiteur : -1, 0 ou 1.")
    comment_count = serializers.IntegerField(help_text="Réponses (question) ou commentaires.")
    can_manage = serializers.BooleanField(help_text="Auteur ou staff : modifier, supprimer.")


class HomeItemSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["post", "question", "snippet", "project", "job"])
    id = serializers.UUIDField()
    created_at = serializers.DateTimeField()
    matched_tags = serializers.ListField(
        child=serializers.CharField(), help_text="Tags suivis par le visiteur (« Pour vous »)."
    )
    post = PostOutputSerializer(allow_null=True)
    card = HomeCardSerializer(allow_null=True)
    stats = HomeStatsSerializer(allow_null=True, help_text="null pour un post.")


class HomePageSerializer(serializers.Serializer):
    next = serializers.CharField(allow_null=True)
    results = HomeItemSerializer(many=True)


def present_home(cards: list[dict], *, viewer, interests) -> list[dict]:
    """Cartes du fil mixte : une lecture des auteurs pour tous les types, posts complets."""
    authors = profile_selectors.author_cards(user_ids={card["author_id"] for card in cards})
    posts = {
        row["id"]: row
        for row in present_posts(
            [card["post"] for card in cards if card["type"] == "post"],
            viewer=viewer,
            authors=authors,
        )
    }
    wanted = {str(tag).lower() for tag in interests}
    viewer_id = viewer.id if getattr(viewer, "is_authenticated", False) else None
    is_staff = bool(getattr(viewer, "is_staff", False))
    reactions = {
        kind: reaction_selectors.summaries(
            target_type=kind,
            target_ids=[card["id"] for card in cards if card["type"] == kind],
            viewer_id=viewer_id,
        )
        for kind in REACTABLE
    }
    target_comments = {
        kind: discussion_selectors.target_comment_counts(
            target_type=kind, target_ids=[card["id"] for card in cards if card["type"] == kind]
        )
        for kind in COMMENTED_TARGETS
    }

    def stats(card):
        if card["type"] not in REACTABLE:
            return None
        summary = reactions[card["type"]].get(card["id"], {})
        meta = card["meta"]
        if card["type"] in COMMENTED_TARGETS:
            comment_count = target_comments[card["type"]].get(card["id"], 0)
        else:
            comment_count = meta.get("answer_count", meta.get("comment_count", 0))
        return {
            "score": summary.get("score", 0),
            "viewer_vote": summary.get("viewer_vote", 0),
            "comment_count": comment_count,
            "can_manage": is_staff or (viewer_id is not None and card["author_id"] == viewer_id),
        }

    items = []
    for card in cards:
        is_post = card["type"] == "post"
        items.append(
            {
                "type": card["type"],
                "id": card["id"],
                "created_at": card["sort_at"],
                "matched_tags": [tag for tag in card["tags"] if str(tag).lower() in wanted][:3],
                "post": posts.get(card["id"]) if is_post else None,
                "card": None
                if is_post
                else {
                    "title": card["title"],
                    "excerpt": card["excerpt"],
                    "tags": card["tags"][:5],
                    "url": card["url"],
                    "author": authors.get(card["author_id"]),
                    "meta": card["meta"],
                },
                "stats": None if is_post else stats(card),
            }
        )
    return items


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
