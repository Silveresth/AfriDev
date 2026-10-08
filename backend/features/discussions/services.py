"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from features.feed import selectors as feed_selectors

from .events import comment_created, comment_deleted, comment_restored
from .models import Comment, ThreadSummary

# Nombre de nouveaux commentaires qui déclenche un nouveau résumé IA.
SUMMARY_MIN_COMMENTS = 5
SUMMARY_REFRESH_EVERY = 5


def thread_group(post_id) -> str:
    return f"discussion.{post_id}"


def _broadcast(post_id, payload: dict) -> None:
    layer = get_channel_layer()
    if layer is not None:
        async_to_sync(layer.group_send)(
            thread_group(post_id), {"type": "comment.event", "payload": payload}
        )


@transaction.atomic
def create_comment(*, author, post_id, body: str, parent_id=None, comment_id=None) -> Comment:
    if comment_id:
        existing = Comment.objects.filter(id=comment_id).first()
        if existing:
            if existing.author_id != author.id:
                raise PermissionDeniedError("Identifiant déjà utilisé.")
            return existing

    body = body.strip()
    if not body:
        raise DomainError("Le commentaire est vide.", code="invalid_comment")
    if feed_selectors.get_post_author_id(post_id=post_id) is None:
        raise NotFoundError("Post introuvable.")
    parent = None
    if parent_id:
        parent = Comment.objects.alive().filter(id=parent_id, post_id=post_id).first()
        if parent is None:
            raise NotFoundError("Commentaire parent introuvable.")

    comment = Comment(post_id=post_id, author=author, body=body, parent=parent)
    if comment_id:
        comment.id = comment_id
    comment.save()

    def _after_commit():
        comment_created.send(
            sender=Comment,
            comment_id=comment.id,
            post_id=comment.post_id,
            author_id=comment.author_id,
            parent_author_id=parent.author_id if parent else None,
            text=comment.body,
        )
        _broadcast(
            post_id,
            {
                "event": "comment.created",
                "comment": {
                    "id": str(comment.id),
                    "post_id": str(comment.post_id),
                    "author_id": str(comment.author_id),
                    "parent_id": str(parent.id) if parent else None,
                    "body": comment.body,
                    "created_at": comment.created_at.isoformat(),
                },
            },
        )
        _maybe_summarize(post_id)

    transaction.on_commit(_after_commit)
    return comment


def delete_comment(*, comment: Comment, user) -> None:
    if comment.author_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul l'auteur peut supprimer ce commentaire.")
    _soft_delete(comment)


def hide_comment(*, comment_id) -> bool:
    """Masquage par la modération."""
    comment = Comment.objects.alive().filter(id=comment_id).first()
    if comment:
        _soft_delete(comment)
    return comment is not None


def restore_comment(*, comment_id) -> bool:
    """Annule un masquage de la modération."""
    comment = Comment.objects.filter(id=comment_id, deleted_at__isnull=False).first()
    if comment is None:
        return False
    comment.deleted_at = None
    comment.save(update_fields=["deleted_at", "updated_at"])
    transaction.on_commit(
        lambda: comment_restored.send(
            sender=Comment, comment_id=comment.id, post_id=comment.post_id
        )
    )
    return True


def _soft_delete(comment: Comment) -> None:
    comment.soft_delete()

    def _after_commit():
        comment_deleted.send(sender=Comment, comment_id=comment.id, post_id=comment.post_id)
        _broadcast(comment.post_id, {"event": "comment.deleted", "comment_id": str(comment.id)})

    transaction.on_commit(_after_commit)


def _maybe_summarize(post_id) -> None:
    from .tasks import ai_summarize_thread

    count = Comment.objects.alive().filter(post_id=post_id).count()
    summary = ThreadSummary.objects.filter(post_id=post_id).first()
    already = summary.comment_count if summary else 0
    if count >= SUMMARY_MIN_COMMENTS and count - already >= SUMMARY_REFRESH_EVERY:
        ai_summarize_thread.delay(str(post_id))


def store_summary(*, post_id, points: list[str], comment_count: int) -> ThreadSummary:
    summary, _ = ThreadSummary.objects.update_or_create(
        post_id=post_id, defaults={"points": points[:3], "comment_count": comment_count}
    )
    return summary


def apply_offline_write(*, user, op: str, record_id, data: dict) -> None:
    """Écriture rejouée depuis la copie locale (features/sync)."""
    if op == "PUT":
        create_comment(
            author=user,
            comment_id=record_id,
            post_id=data.get("post_id"),
            body=data.get("body") or "",
            parent_id=data.get("parent_id") or None,
        )
        return
    comment = Comment.objects.alive().filter(id=record_id).first()
    if comment is None:
        raise NotFoundError("Commentaire introuvable.")
    if op == "DELETE":
        delete_comment(comment=comment, user=user)
    elif op == "PATCH":
        if comment.author_id != user.id:
            raise PermissionDeniedError("Seul l'auteur peut modifier ce commentaire.")
        if data.get("body", "").strip():
            comment.body = data["body"].strip()
            comment.save(update_fields=["body", "updated_at"])
