"""Écritures (collections et éléments enregistrés). Seul point d'entrée en écriture."""

from django.db import IntegrityError, transaction

from core.exceptions import ConflictError, DomainError, NotFoundError, PermissionDeniedError
from features.feed import selectors as feed_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

from .events import bookmark_changed
from .models import BookmarkCollection, BookmarkItem

TARGET_FIELDS = {"post": "post_id", "snippet": "snippet_id", "question": "question_id"}
DEFAULT_COLLECTION = "Favoris"
MAX_COLLECTIONS = 50


def _check_owner(collection: BookmarkCollection, user) -> None:
    if collection.owner_id != user.id:
        raise PermissionDeniedError("Cette collection appartient à quelqu'un d'autre.")


def _clean_name(name: str) -> str:
    name = (name or "").strip()[:60]
    if not name:
        raise DomainError("La collection a besoin d'un nom.", code="invalid_collection")
    return name


@transaction.atomic
def create_collection(
    *, owner, name: str, description: str = "", is_private: bool = True
) -> BookmarkCollection:
    if BookmarkCollection.objects.filter(owner=owner).count() >= MAX_COLLECTIONS:
        raise DomainError(
            f"Au plus {MAX_COLLECTIONS} collections par membre.", code="too_many_collections"
        )
    name = _clean_name(name)
    try:
        with transaction.atomic():
            return BookmarkCollection.objects.create(
                owner=owner, name=name, description=description.strip()[:300], is_private=is_private
            )
    except IntegrityError as exc:
        raise ConflictError(
            f"Vous avez déjà une collection « {name} ».", code="name_taken"
        ) from exc


@transaction.atomic
def update_collection(*, collection: BookmarkCollection, user, **fields) -> BookmarkCollection:
    _check_owner(collection, user)
    changed = []
    if fields.get("name") is not None:
        name = _clean_name(fields["name"])
        if name != collection.name:
            if BookmarkCollection.objects.filter(owner=user, name=name).exists():
                raise ConflictError(f"Vous avez déjà une collection « {name} ».", code="name_taken")
            collection.name = name
            changed.append("name")
    if fields.get("description") is not None:
        collection.description = fields["description"].strip()[:300]
        changed.append("description")
    if fields.get("is_private") is not None:
        collection.is_private = bool(fields["is_private"])
        changed.append("is_private")
    if changed:
        collection.save(update_fields=[*changed, "updated_at"])
    return collection


@transaction.atomic
def delete_collection(*, collection: BookmarkCollection, user) -> None:
    _check_owner(collection, user)
    targets = [(item.target_type, item.target_id) for item in collection.items.all()]
    collection.delete()  # suppression réelle : les éléments partent avec la collection
    for target_type, target_id in targets:
        _announce(owner_id=user.id, target_type=target_type, target_id=target_id, added=False)


def ensure_default_collection(*, owner) -> BookmarkCollection:
    collection = BookmarkCollection.objects.filter(owner=owner).order_by("created_at").first()
    return collection or create_collection(owner=owner, name=DEFAULT_COLLECTION)


def _target_exists(*, target_type: str, target_id, user) -> bool:
    if target_type == "post":
        return bool(feed_selectors.post_summaries(post_ids=[target_id]))
    if target_type == "question":
        return bool(qa_selectors.question_summaries(question_ids=[target_id]))
    return bool(snippet_selectors.snippet_summaries(snippet_ids=[target_id], viewer_id=user.id))


def _announce(*, owner_id, target_type: str, target_id, added: bool) -> None:
    transaction.on_commit(
        lambda: bookmark_changed.send(
            sender=BookmarkItem,
            owner_id=owner_id,
            target_type=target_type,
            target_id=target_id,
            added=added,
        )
    )


@transaction.atomic
def add_item(*, collection: BookmarkCollection, user, target_type: str, target_id) -> BookmarkItem:
    """Idempotent : enregistrer deux fois le même contenu dans la collection ne change rien."""
    _check_owner(collection, user)
    field = TARGET_FIELDS.get(target_type)
    if field is None:
        raise DomainError("Type de contenu inconnu.", code="invalid_target")
    existing = BookmarkItem.objects.filter(collection=collection, **{field: target_id}).first()
    if existing:
        return existing
    if not _target_exists(target_type=target_type, target_id=target_id, user=user):
        raise NotFoundError("Contenu introuvable ou privé.", code="target_not_found")
    item = BookmarkItem.objects.create(collection=collection, owner=user, **{field: target_id})
    collection.save(update_fields=["updated_at"])
    _announce(owner_id=user.id, target_type=target_type, target_id=target_id, added=True)
    return item


@transaction.atomic
def remove_item(*, item: BookmarkItem, user) -> None:
    if item.owner_id != user.id:
        raise PermissionDeniedError("Cet élément appartient à quelqu'un d'autre.")
    target_type, target_id = item.target_type, item.target_id
    item.delete()
    _announce(owner_id=user.id, target_type=target_type, target_id=target_id, added=False)


@transaction.atomic
def remove_target(*, collection: BookmarkCollection, user, target_type: str, target_id) -> None:
    """Retire un contenu d'une collection (case décochée dans « Enregistrer dans… »)."""
    _check_owner(collection, user)
    field = TARGET_FIELDS.get(target_type)
    if field is None:
        raise DomainError("Type de contenu inconnu.", code="invalid_target")
    deleted, _ = BookmarkItem.objects.filter(collection=collection, **{field: target_id}).delete()
    if deleted:
        _announce(owner_id=user.id, target_type=target_type, target_id=target_id, added=False)
