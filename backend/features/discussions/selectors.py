"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, QuerySet

from core.stats import count_per_day

from .models import Comment, TargetComment, ThreadSummary


def list_comments(*, post_id) -> QuerySet[Comment]:
    return Comment.objects.alive().filter(post_id=post_id)


def list_target_comments(*, target_type: str, target_id) -> QuerySet[TargetComment]:
    return TargetComment.objects.alive().filter(target_type=target_type, target_id=target_id)


def get_target_comment(*, comment_id, include_hidden: bool = False) -> TargetComment | None:
    comments = TargetComment.objects.all() if include_hidden else TargetComment.objects.alive()
    return comments.filter(id=comment_id).first()


def target_comment_counts(*, target_type: str, target_ids) -> dict:
    """{target_id: nombre de commentaires} en une requête (cartes du fil, listes)."""
    ids = [target_id for target_id in target_ids if target_id]
    if not ids:
        return {}
    rows = (
        TargetComment.objects.alive()
        .filter(target_type=target_type, target_id__in=ids)
        .values("target_id")
        .annotate(n=Count("id"))
    )
    return {row["target_id"]: row["n"] for row in rows}


def get_comment(*, comment_id, include_hidden: bool = False) -> Comment | None:
    comments = Comment.objects.all() if include_hidden else Comment.objects.alive()
    return comments.filter(id=comment_id).first()


def get_summary(*, post_id) -> ThreadSummary | None:
    return ThreadSummary.objects.filter(post_id=post_id).first()


def thread_text(*, post_id, limit: int = 80) -> tuple[list[str], int]:
    """Les commentaires les plus récents (texte brut) et le nombre total, pour le résumé IA."""
    comments = list_comments(post_id=post_id)
    total = comments.count()
    recent = comments.order_by("-created_at").values_list("body", flat=True)[:limit]
    return list(reversed(recent)), total


def comment_stats(*, since) -> dict:
    comments = Comment.objects.alive()
    return {"total": comments.count(), "new": comments.filter(created_at__gte=since).count()}


def comments_per_day(*, since) -> dict[str, int]:
    return count_per_day(Comment.objects.alive(), since=since)


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD)."""
    return {
        "comments": list(
            Comment.objects.filter(author_id=user_id).values(
                "id", "post_id", "parent_id", "body", "created_at", "deleted_at"
            )
        ),
        "project_and_job_comments": list(
            TargetComment.objects.filter(author_id=user_id).values(
                "id", "target_type", "target_id", "parent_id", "body", "created_at", "deleted_at"
            )
        ),
    }
