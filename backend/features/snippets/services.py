"""Écritures. Seul point d'entrée en écriture."""

from django.db import transaction
from django.db.models import Case, F, Max, Value, When
from django.utils import timezone

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from core.utils import normalize_tags
from features.hubs import services as hub_services

from .events import (
    snippet_comment_created,
    snippet_flagged,
    snippet_published,
    snippet_unpublished,
)
from .models import Snippet, SnippetComment, SnippetVersion
from .security_guard import scan_for_secrets


class SecretDetectedError(DomainError):
    code = "secret_detected"


def _guard(content: str) -> None:
    findings = scan_for_secrets(content)
    if findings:
        first = findings[0]
        raise SecretDetectedError(
            f"Secret détecté ({first.description}) à la ligne {first.line}.",
            details={"findings": [f.__dict__ for f in findings]},
        )


def _check_owner(snippet: Snippet, user) -> None:
    if snippet.owner_id != user.id:
        raise PermissionDeniedError("Ce snippet appartient à quelqu'un d'autre.")


@transaction.atomic
def create_snippet(
    *,
    owner,
    title: str,
    language: str,
    content: str,
    tags: list[str] | None = None,
    is_public: bool = False,
    hub_id=None,
    snippet_id=None,
) -> Snippet:
    """`snippet_id` : identifiant généré hors ligne (rejouer l'envoi est sans effet)."""
    if snippet_id:
        existing = Snippet.objects.filter(id=snippet_id).first()
        if existing:
            _check_owner(existing, owner)
            return existing

    _guard(content)
    snippet = Snippet(
        owner=owner,
        title=title.strip(),
        language=language.strip().lower(),
        content=content,
        tags=normalize_tags(tags),
        hub_id=hub_services.require_hub(hub_id=hub_id, user=owner),
    )
    if snippet_id:
        snippet.id = snippet_id
    snippet.save()
    SnippetVersion.objects.create(snippet=snippet, content=content, number=1)
    if is_public:
        publish_snippet(snippet=snippet)
    return snippet


@transaction.atomic
def update_snippet(
    *, snippet: Snippet, user, title=None, language=None, content=None, tags=None, hub_id=...
) -> Snippet:
    """hub_id : absent = inchangé, None = retirer du hub, UUID = rattacher à ce hub."""
    if not user.is_staff:
        _check_owner(snippet, user)
    fields = []
    if content is not None and content != snippet.content:
        _guard(content)
        snippet.content = content
        fields.append("content")
        last = snippet.versions.aggregate(n=Max("number"))["n"] or 0
        SnippetVersion.objects.create(snippet=snippet, content=content, number=last + 1)
    if title is not None and title.strip() != snippet.title:
        snippet.title = title.strip()
        fields.append("title")
    if language is not None and language.strip().lower() != snippet.language:
        snippet.language = language.strip().lower()
        fields.append("language")
    if tags is not None:
        snippet.tags = normalize_tags(tags)
        fields.append("tags")
    if hub_id is not ... and hub_id != snippet.hub_id:
        snippet.hub_id = hub_services.require_hub(hub_id=hub_id, user=user)
        fields.append("hub_id")
    if fields:
        snippet.save(update_fields=[*fields, "updated_at"])
        if snippet.is_public and "content" in fields:
            _after_publication(snippet)  # nouvelle analyse IA et réindexation
    return snippet


def _after_publication(snippet: Snippet) -> None:
    from .tasks import ai_analyze_snippet

    transaction.on_commit(lambda: ai_analyze_snippet.delay(str(snippet.id)))
    transaction.on_commit(lambda: snippet_published.send(sender=Snippet, snippet_id=snippet.id))


@transaction.atomic
def publish_snippet(*, snippet: Snippet) -> Snippet:
    _guard(snippet.content)
    if snippet.is_public:
        return snippet
    snippet.is_public = True
    snippet.published_at = timezone.now()
    snippet.save(update_fields=["is_public", "published_at", "updated_at"])
    _after_publication(snippet)
    return snippet


@transaction.atomic
def unpublish_snippet(*, snippet: Snippet) -> Snippet:
    if not snippet.is_public:
        return snippet
    snippet.is_public = False
    snippet.save(update_fields=["is_public", "updated_at"])
    transaction.on_commit(lambda: snippet_unpublished.send(sender=Snippet, snippet_id=snippet.id))
    return snippet


def hide_snippet(*, snippet_id) -> bool:
    """Masquage par la modération (réversible depuis le back-office)."""
    snippet = Snippet.objects.alive().filter(id=snippet_id).first()
    if snippet:
        snippet.soft_delete()
        if snippet.is_public:
            transaction.on_commit(
                lambda: snippet_unpublished.send(sender=Snippet, snippet_id=snippet.id)
            )
    return snippet is not None


def restore_snippet(*, snippet_id) -> bool:
    snippet = Snippet.objects.filter(id=snippet_id, deleted_at__isnull=False).first()
    if snippet:
        snippet.deleted_at = None
        snippet.save(update_fields=["deleted_at", "updated_at"])
        if snippet.is_public:
            transaction.on_commit(
                lambda: snippet_published.send(sender=Snippet, snippet_id=snippet.id)
            )
    return snippet is not None


@transaction.atomic
def delete_snippet(*, snippet: Snippet, user) -> None:
    is_allowed = snippet.owner_id == user.id or user.is_staff
    if not is_allowed and snippet.hub_id:
        from features.hubs import selectors as hub_selectors

        is_allowed = hub_selectors.is_hub_moderator(hub_id=snippet.hub_id, user=user)
    if not is_allowed:
        raise PermissionDeniedError("Vous n'êtes pas autorisé à supprimer ce snippet.")
    was_public = snippet.is_public
    snippet.soft_delete()
    if was_public:
        transaction.on_commit(
            lambda: snippet_unpublished.send(sender=Snippet, snippet_id=snippet.id)
        )


@transaction.atomic
def store_ai_review(*, snippet_id, risky: bool, reasons: list[str], tags: list[str]) -> None:
    """Résultat de l'étage 2 : un snippet jugé à risque est retiré de la publication."""
    snippet = Snippet.objects.alive().select_for_update().filter(id=snippet_id).first()
    if snippet is None:
        return
    snippet.ai_review = {
        "risky": risky,
        "reasons": reasons[:5],
        "checked_at": timezone.now().isoformat(),
    }
    fields = ["ai_review"]
    if not snippet.tags and tags:
        snippet.tags = normalize_tags(tags)
        fields.append("tags")
    snippet.save(update_fields=[*fields, "updated_at"])
    if risky and snippet.is_public:
        unpublish_snippet(snippet=snippet)
        transaction.on_commit(
            lambda: snippet_flagged.send(
                sender=Snippet, snippet_id=snippet.id, owner_id=snippet.owner_id, reasons=reasons
            )
        )


def apply_offline_write(*, user, op: str, record_id, data: dict) -> None:
    """Écriture rejouée depuis la copie locale (features/sync)."""
    if op == "PUT":
        create_snippet(
            owner=user,
            snippet_id=record_id,
            title=data.get("title") or "Sans titre",
            language=data.get("language") or "text",
            content=data.get("content") or "",
            tags=data.get("tags"),
            is_public=bool(data.get("is_public")),
            hub_id=data.get("hub_id") or None,
        )
        return
    snippet = Snippet.objects.alive().filter(id=record_id).first()
    if snippet is None:
        raise NotFoundError("Snippet introuvable.")
    if op == "DELETE":
        delete_snippet(snippet=snippet, user=user)
        return
    if op == "PATCH":
        update_snippet(
            snippet=snippet,
            user=user,
            title=data.get("title"),
            language=data.get("language"),
            content=data.get("content"),
            tags=data.get("tags"),
        )
        if "is_public" in data:
            if bool(data["is_public"]):
                publish_snippet(snippet=snippet)
            else:
                unpublish_snippet(snippet=snippet)


@transaction.atomic
def add_comment(*, snippet: Snippet, author, body: str, parent_id=None) -> SnippetComment:
    """Ajoute un commentaire à un snippet public avec incrément atomique de comment_count."""
    parent = None
    if parent_id:
        parent = (
            SnippetComment.objects.alive()
            .filter(id=parent_id, snippet=snippet, parent__isnull=True)
            .first()
        )

    comment = SnippetComment.objects.create(
        snippet=snippet,
        author=author,
        body=body.strip(),
        parent=parent,
    )
    Snippet.objects.filter(pk=snippet.pk).update(comment_count=F("comment_count") + 1)
    transaction.on_commit(
        lambda: snippet_comment_created.send(
            sender=SnippetComment,
            comment_id=comment.id,
            snippet_id=snippet.id,
            owner_id=snippet.owner_id,
            author_id=author.id,
            parent_author_id=parent.author_id if parent else None,
            text=comment.body,
        )
    )
    return comment


@transaction.atomic
def delete_comment(*, comment: SnippetComment, user) -> None:
    """Soft-delete d'un commentaire (auteur ou modérateur du hub) et décrément."""
    is_allowed = comment.author_id == user.id or getattr(user, "is_staff", False)

    if not is_allowed:
        snippet = Snippet.objects.alive().filter(id=comment.snippet_id).first()
        if snippet and snippet.hub_id:
            from features.hubs import selectors as hub_selectors

            is_allowed = hub_selectors.is_hub_moderator(hub_id=snippet.hub_id, user=user)

    if not is_allowed:
        raise PermissionDeniedError("Vous ne pouvez pas supprimer ce commentaire.")

    comment.soft_delete()
    Snippet.objects.filter(pk=comment.snippet_id).update(
        comment_count=Case(
            When(comment_count__gt=0, then=F("comment_count") - 1),
            default=Value(0),
        )
    )


def hide_comment(*, comment_id) -> bool:
    """Modération : masque un commentaire (réversible). Faux s'il était déjà masqué ou absent."""
    comment = SnippetComment.objects.alive().filter(id=comment_id).first()
    if comment is None:
        return False
    comment.soft_delete()
    Snippet.objects.filter(pk=comment.snippet_id).update(
        comment_count=Case(
            When(comment_count__gt=0, then=F("comment_count") - 1),
            default=Value(0),
        )
    )
    return True


def restore_comment(*, comment_id) -> bool:
    """Modération : rétablit un commentaire masqué."""
    updated = SnippetComment.objects.filter(id=comment_id, deleted_at__isnull=False).update(
        deleted_at=None
    )
    if not updated:
        return False
    comment = SnippetComment.objects.get(id=comment_id)
    Snippet.objects.filter(pk=comment.snippet_id).update(comment_count=F("comment_count") + 1)
    return True
