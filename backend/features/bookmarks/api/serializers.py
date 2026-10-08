from rest_framework import serializers

from core.serializers import AuthorSerializer
from features.feed import selectors as feed_selectors
from features.profiles import selectors as profile_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

TARGET_TYPES = [("post", "Post"), ("question", "Question"), ("snippet", "Snippet")]
HREFS = {"post": "/feed/{}", "question": "/questions/{}", "snippet": "/snippets/{}"}


class CollectionInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    description = serializers.CharField(max_length=300, required=False, allow_blank=True)
    is_private = serializers.BooleanField(required=False, default=True)


class CollectionUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60, required=False)
    description = serializers.CharField(max_length=300, required=False, allow_blank=True)
    is_private = serializers.BooleanField(required=False)


class CollectionOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    is_private = serializers.BooleanField()
    item_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class ItemInputSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=TARGET_TYPES)
    target_id = serializers.UUIDField()


class BookmarkTargetSerializer(serializers.Serializer):
    title = serializers.CharField()
    excerpt = serializers.CharField()
    href = serializers.CharField()
    language = serializers.CharField(allow_null=True)
    author = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()


class ItemOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    collection_id = serializers.UUIDField()
    target_type = serializers.ChoiceField(choices=TARGET_TYPES)
    target_id = serializers.UUIDField()
    # null : contenu supprimé, masqué par la modération ou redevenu privé.
    target = BookmarkTargetSerializer(allow_null=True)
    saved_at = serializers.DateTimeField()


class SavedTargetSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=TARGET_TYPES)
    target_id = serializers.UUIDField()
    collection_ids = serializers.ListField(child=serializers.UUIDField())


def present_collections(collections) -> list[dict]:
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "is_private": c.is_private,
            "item_count": getattr(c, "item_count", 0),
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in collections
    ]


def present_items(items, *, viewer) -> list[dict]:
    """Résout titre, extrait et auteur de chaque contenu en une requête par type."""
    items = list(items)
    by_type: dict[str, list] = {"post": [], "question": [], "snippet": []}
    for item in items:
        by_type[item.target_type].append(item.target_id)
    summaries = {
        "post": feed_selectors.post_summaries(post_ids=by_type["post"]),
        "question": qa_selectors.question_summaries(question_ids=by_type["question"]),
        "snippet": snippet_selectors.snippet_summaries(
            snippet_ids=by_type["snippet"], viewer_id=viewer.id
        ),
    }
    authors = profile_selectors.author_cards(
        user_ids={s["author_id"] for group in summaries.values() for s in group.values()}
    )
    rows = []
    for item in items:
        summary = summaries[item.target_type].get(item.target_id)
        rows.append(
            {
                "id": item.id,
                "collection_id": item.collection_id,
                "target_type": item.target_type,
                "target_id": item.target_id,
                "target": (
                    {
                        "title": summary["title"],
                        "excerpt": summary["excerpt"],
                        "href": HREFS[item.target_type].format(item.target_id),
                        "language": summary.get("language"),
                        "author": authors.get(summary["author_id"]),
                        "created_at": summary["created_at"],
                    }
                    if summary
                    else None
                ),
                "saved_at": item.created_at,
            }
        )
    return rows
