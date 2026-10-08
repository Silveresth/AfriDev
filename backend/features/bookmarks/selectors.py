"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, Q, QuerySet

from .models import BookmarkCollection, BookmarkItem


def list_collections(*, owner_id) -> QuerySet[BookmarkCollection]:
    return (
        BookmarkCollection.objects.filter(owner_id=owner_id)
        .annotate(item_count=Count("items"))
        .order_by("created_at")
    )


def list_public_collections(*, owner_id) -> QuerySet[BookmarkCollection]:
    return list_collections(owner_id=owner_id).filter(is_private=False)


def get_collection(*, collection_id) -> BookmarkCollection | None:
    return (
        BookmarkCollection.objects.filter(id=collection_id)
        .annotate(item_count=Count("items"))
        .first()
    )


def list_items(*, collection_id) -> QuerySet[BookmarkItem]:
    return BookmarkItem.objects.filter(collection_id=collection_id)


def get_item(*, item_id) -> BookmarkItem | None:
    return BookmarkItem.objects.filter(id=item_id).first()


def saved_targets(*, owner_id) -> list[dict]:
    """[{target_type, target_id, collection_ids}] : tout ce que le membre a enregistré
    (état des boutons marque-page et des cases de « Enregistrer dans… »)."""
    targets: dict = {}
    for item in BookmarkItem.objects.filter(owner_id=owner_id).order_by("created_at"):
        key = (item.target_type, item.target_id)
        targets.setdefault(key, []).append(item.collection_id)
    return [
        {"target_type": target_type, "target_id": target_id, "collection_ids": ids}
        for (target_type, target_id), ids in targets.items()
    ]


def snippet_save_count(*, snippet_ids, exclude_owner_id=None) -> int:
    """Membres distincts ayant enregistré l'un de ces snippets (karma de leur auteur)."""
    items = BookmarkItem.objects.filter(snippet_id__in=list(snippet_ids))
    if exclude_owner_id:
        items = items.filter(~Q(owner_id=exclude_owner_id))
    return items.values("owner_id", "snippet_id").distinct().count()


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD)."""
    return {
        "bookmark_collections": [
            {
                "name": collection.name,
                "description": collection.description,
                "is_private": collection.is_private,
                "items": [
                    {"type": item.target_type, "id": item.target_id, "saved_at": item.created_at}
                    for item in collection.items.all()
                ],
            }
            for collection in BookmarkCollection.objects.filter(owner_id=user_id)
        ]
    }
