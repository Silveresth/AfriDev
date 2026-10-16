"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Q, QuerySet

from core.utils import keyset_before

from .models import Snippet, SnippetComment
from .security_guard import SecretFinding, scan_for_secrets


def list_snippets(*, owner) -> QuerySet[Snippet]:
    return Snippet.objects.alive().filter(owner=owner)


def get_owned_snippet(*, snippet_id, owner) -> Snippet | None:
    return list_snippets(owner=owner).filter(id=snippet_id).first()


def get_public_snippet(*, snippet_id) -> Snippet | None:
    return Snippet.objects.alive().filter(id=snippet_id, is_public=True).first()


def list_public_snippets(
    *, language: str | None = None, query: str | None = None, owner_id=None, hub_id=None
) -> QuerySet[Snippet]:
    snippets = Snippet.objects.alive().filter(is_public=True)
    if hub_id:
        snippets = snippets.filter(hub_id=hub_id)
    if owner_id:
        snippets = snippets.filter(owner_id=owner_id)
    if language:
        snippets = snippets.filter(language=language.lower())
    if query:
        # Recherche simple ; la recherche tolérante aux fautes passe par features/knowledge.
        snippets = snippets.filter(Q(title__icontains=query) | Q(tags__icontains=query))
    return snippets


def find_secrets(text: str) -> list[SecretFinding]:
    """Security Guard réutilisable par les autres features (questions, posts)."""
    return scan_for_secrets(text)


def snippet_stats(*, since) -> dict:
    snippets = Snippet.objects.alive()
    return {
        "total": snippets.count(),
        "new": snippets.filter(created_at__gte=since).count(),
        "public": snippets.filter(is_public=True).count(),
        # Repassés en privé par le second étage du Security Guard (analyse IA).
        "flagged": snippets.filter(ai_review__risky=True, is_public=False).count(),
    }


def home_candidates(*, before=None, limit: int, author_ids=None) -> list[dict]:
    """Snippets publics récents pour le fil d'accueil (index is_public, -published_at)."""
    snippets = list_public_snippets().filter(published_at__isnull=False)
    if author_ids is not None:
        snippets = snippets.filter(owner_id__in=list(author_ids))
    rows = keyset_before(snippets, "published_at", before).only(
        "id", "title", "language", "content", "tags", "owner_id", "published_at"
    )[:limit]
    result = []
    for s in rows:
        lines = s.content.splitlines()
        result.append(
            {
                "type": "snippet",
                "id": s.id,
                "title": s.title,
                # Aperçu : 8 premières lignes, le code complet reste sur la page du snippet.
                "excerpt": "\n".join(lines[:8])[:600],
                "tags": list(s.tags or []),
                "author_id": s.owner_id,
                "sort_at": s.published_at,
                "url": f"/snippets/{s.id}",
                "popularity": 0,
                "meta": {"language": s.language, "lines": len(lines)},
            }
        )
    return result


def snippet_summaries(*, snippet_ids, viewer_id=None) -> dict:
    """{snippet_id: {title, excerpt, language, author_id, created_at}} : publics, ou à soi."""
    rows = Snippet.objects.alive().filter(id__in=list(snippet_ids))
    rows = (
        rows.filter(Q(is_public=True) | Q(owner_id=viewer_id))
        if viewer_id
        else rows.filter(is_public=True)
    )
    return {
        s.id: {
            "title": s.title,
            "excerpt": s.content[:200],
            "language": s.language,
            "author_id": s.owner_id,
            "created_at": s.created_at,
        }
        for s in rows
    }


def get_snippet_owner_id(*, snippet_id):
    return Snippet.objects.filter(id=snippet_id).values_list("owner_id", flat=True).first()


def public_snippet_ids(*, owner_id) -> list:
    return list(
        Snippet.objects.alive()
        .filter(owner_id=owner_id, is_public=True)
        .values_list("id", flat=True)
    )


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD), contenu complet des snippets compris."""
    return {
        "snippets": list(
            Snippet.objects.filter(owner_id=user_id).values(
                "id",
                "title",
                "language",
                "content",
                "tags",
                "is_public",
                "created_at",
                "deleted_at",
            )
        )
    }


def list_comments(*, snippet_id) -> QuerySet:
    """Commentaires non supprimés d'un snippet, ordonnés chronologiquement."""
    return SnippetComment.objects.alive().filter(snippet_id=snippet_id).order_by("created_at")


def get_comment(*, comment_id, author=None) -> SnippetComment | None:
    """Récupère un commentaire par son identifiant, optionnellement filtré par auteur."""
    qs = SnippetComment.objects.alive().filter(id=comment_id)
    if author is not None:
        qs = qs.filter(author=author)
    return qs.first()
