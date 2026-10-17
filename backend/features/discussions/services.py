"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from features.feed import selectors as feed_selectors
from features.jobs_events import selectors as jobs_selectors
from features.projects import selectors as project_selectors

from .events import comment_created, comment_deleted, comment_restored, target_comment_created
from .models import Comment, TargetComment, ThreadSummary

# ── Projets et offres d'emploi ──


def _target_owner_id(target_type: str, target_id):
    """Auteur du projet ou de l'offre ; None si le contenu n'existe pas (ou plus)."""
    if target_type == TargetComment.TargetType.PROJECT:
        project = project_selectors.get_project(project_id=target_id)
        return project.owner_id if project else None
    if target_type == TargetComment.TargetType.JOB:
        job = jobs_selectors.get_job(job_id=target_id)
        return job.author_id if job else None
    raise DomainError("Type de contenu inconnu.", code="invalid_target")


@transaction.atomic
def create_target_comment(
    *, author, target_type: str, target_id, body: str, parent_id=None
) -> TargetComment:
    body = (body or "").strip()
    if not body:
        raise DomainError("Le commentaire est vide.", code="invalid_comment")
    owner_id = _target_owner_id(target_type, target_id)
    if owner_id is None:
        raise NotFoundError("Contenu introuvable.")
    parent = None
    if parent_id:
        parent = (
            TargetComment.objects.alive()
            .filter(id=parent_id, target_type=target_type, target_id=target_id)
            .first()
        )
        if parent is None:
            raise NotFoundError("Commentaire parent introuvable.")
    comment = TargetComment.objects.create(
        target_type=target_type, target_id=target_id, author=author, body=body, parent=parent
    )
    transaction.on_commit(
        lambda: target_comment_created.send(
            sender=TargetComment,
            comment_id=comment.id,
            target_type=target_type,
            target_id=target_id,
            owner_id=owner_id,
            author_id=author.id,
            parent_author_id=parent.author_id if parent else None,
            text=body,
        )
    )
    return comment


def delete_target_comment(*, comment: TargetComment, user) -> None:
    """Auteur du commentaire, auteur du projet / de l'offre, ou équipe de modération."""
    allowed = (
        comment.author_id == user.id
        or getattr(user, "is_staff", False)
        or _target_owner_id(comment.target_type, comment.target_id) == user.id
    )
    if not allowed:
        raise PermissionDeniedError("Vous ne pouvez pas supprimer ce commentaire.")
    comment.soft_delete()


def hide_target_comment(*, comment_id) -> bool:
    """Masquage par la modération."""
    comment = TargetComment.objects.alive().filter(id=comment_id).first()
    if comment:
        comment.soft_delete()
    return comment is not None


def restore_target_comment(*, comment_id) -> bool:
    comment = TargetComment.objects.filter(id=comment_id, deleted_at__isnull=False).first()
    if comment:
        comment.deleted_at = None
        comment.save(update_fields=["deleted_at", "updated_at"])
    return comment is not None


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
    is_allowed = comment.author_id == user.id or getattr(user, "is_staff", False)
    if not is_allowed:
        post = feed_selectors.get_post(post_id=comment.post_id)
        if post and post.hub_id:
            from features.hubs import selectors as hub_selectors

            is_allowed = hub_selectors.is_hub_moderator(hub_id=post.hub_id, user=user)

    if not is_allowed:
        raise PermissionDeniedError(
            "Seul l'auteur ou un modérateur du hub peut supprimer ce commentaire."
        )
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
