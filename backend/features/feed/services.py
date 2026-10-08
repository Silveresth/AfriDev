"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

import math
from datetime import UTC, datetime

from django.db import transaction
from django.db.models import Count, F, Q, Sum

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from core.utils import normalize_tags, parse_json_list
from features.hubs import services as hub_services
from features.media import selectors as media_selectors

from .events import post_liked, post_published, post_vote_changed
from .models import PollVote, Post, PostLike

MEDIA_KIND = {Post.Kind.IMAGE: "image", Post.Kind.SHORT: "video"}

# Origine des rangs : seuls les écarts comptent, elle garde des nombres petits.
RANK_EPOCH = datetime(2025, 1, 1, tzinfo=UTC).timestamp()


def ranks(*, score: int, created_at) -> tuple[float, float]:
    """(hot, top) d'un post.

    hot : formule de Reddit, l'ordre de grandeur du score plus l'âge (12,5 h ≈ un facteur 10
    de votes), pour que les posts récents et appréciés remontent.
    top : le score, l'ancienneté ne servant qu'à départager (fraction < 1).
    """
    seconds = created_at.timestamp() - RANK_EPOCH
    sign = (score > 0) - (score < 0)
    hot = sign * math.log10(max(abs(score), 1)) + seconds / 45000
    top = score + seconds / 1e10
    return round(hot, 7), top


def _content_text(post: Post) -> str:
    return f"{post.title}\n\n{post.body}".strip()


def _validate(
    *, author, kind: str, title: str, body: str, poll_options: list, media_id
) -> list[str]:
    if kind not in Post.Kind.values:
        raise DomainError(f"Type de post inconnu : {kind}.", code="invalid_post")
    options = [str(option).strip()[:80] for option in poll_options if str(option).strip()]
    if kind == Post.Kind.POLL:
        if not (title.strip() or body.strip()):
            raise DomainError("Un sondage a besoin d'une question.", code="invalid_post")
        if not 2 <= len(options) <= 4:
            raise DomainError("Un sondage propose de 2 à 4 choix.", code="invalid_post")
    elif options:
        raise DomainError("Seul un sondage peut avoir des choix.", code="invalid_post")

    if kind in MEDIA_KIND:
        if not media_id or not media_selectors.get_owned_asset(
            asset_id=media_id, owner_id=author.id, kind=MEDIA_KIND[kind]
        ):
            raise DomainError("Média manquant ou invalide pour ce post.", code="invalid_media")
    elif media_id:
        raise DomainError("Ce type de post n'accepte pas de média.", code="invalid_post")
    elif not (title.strip() or body.strip()):
        raise DomainError("Le post est vide.", code="invalid_post")
    return options


@transaction.atomic
def create_post(
    *,
    author,
    kind: str = Post.Kind.TEXT,
    title: str = "",
    body: str = "",
    poll_options: list | None = None,
    media_id=None,
    tags: list | None = None,
    hub_id=None,
    post_id=None,
) -> Post:
    """`post_id` : identifiant généré hors ligne par le client (rejouer l'envoi est sans effet)."""
    if post_id:
        existing = Post.objects.filter(id=post_id).first()
        if existing:
            if existing.author_id != author.id:
                raise PermissionDeniedError("Identifiant déjà utilisé.")
            return existing

    options = _validate(
        author=author,
        kind=kind,
        title=title,
        body=body,
        poll_options=poll_options or [],
        media_id=media_id,
    )
    post = Post(
        author=author,
        kind=kind,
        title=title.strip()[:200],
        body=body.strip(),
        poll_options=options,
        media_id=media_id or None,
        tags=normalize_tags(tags),
        hub_id=hub_services.require_hub(hub_id=hub_id),
    )
    if post_id:
        post.id = post_id
    post.hot, post.top = ranks(score=0, created_at=post.created_at)
    post.save()

    text = _content_text(post)
    if not post.tags and len(text) >= 80:
        from .tasks import ai_tag_post

        transaction.on_commit(lambda: ai_tag_post.delay(str(post.id)))
    transaction.on_commit(
        lambda: post_published.send(
            sender=Post, post_id=post.id, author_id=post.author_id, text=text
        )
    )
    return post


@transaction.atomic
def update_post(
    *,
    post: Post,
    user,
    title: str | None = None,
    body: str | None = None,
    tags=None,
    hub_id=...,
) -> Post:
    """hub_id : absent = inchangé, None = retirer du hub, UUID = déplacer dans ce hub."""
    if post.author_id != user.id:
        raise PermissionDeniedError("Seul l'auteur peut modifier ce post.")
    fields = []
    if title is not None and title.strip() != post.title:
        post.title = title.strip()[:200]
        fields.append("title")
    if body is not None and body.strip() != post.body:
        post.body = body.strip()
        fields.append("body")
    if post.kind == Post.Kind.TEXT and not (post.title or post.body):
        raise DomainError("Le post est vide.", code="invalid_post")
    if tags is not None:
        post.tags = normalize_tags(tags)
        fields.append("tags")
    if hub_id is not ... and hub_id != post.hub_id:
        post.hub_id = hub_services.require_hub(hub_id=hub_id)
        fields.append("hub_id")
    if fields:
        post.save(update_fields=[*fields, "updated_at"])
    return post


def delete_post(*, post: Post, user) -> None:
    if post.author_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul l'auteur peut supprimer ce post.")
    post.soft_delete()


def hide_post(*, post_id) -> bool:
    """Masquage par la modération (réversible depuis l'admin)."""
    post = Post.objects.alive().filter(id=post_id).first()
    if post:
        post.soft_delete()
    return post is not None


def restore_post(*, post_id) -> bool:
    """Annule un masquage de la modération (le post réapparaît dans le fil)."""
    post = Post.objects.filter(id=post_id, deleted_at__isnull=False).first()
    if post:
        post.deleted_at = None
        post.save(update_fields=["deleted_at", "updated_at"])
    return post is not None


def set_tags(*, post_id, tags: list) -> None:
    Post.objects.filter(id=post_id, tags=[]).update(tags=normalize_tags(tags))


@transaction.atomic
def vote_poll(*, post: Post, user, option: int) -> PollVote:
    if post.kind != Post.Kind.POLL:
        raise DomainError("Ce post n'est pas un sondage.", code="not_a_poll")
    if not 0 <= option < len(post.poll_options):
        raise DomainError("Choix invalide.", code="invalid_option")
    vote, _ = PollVote.objects.update_or_create(post=post, voter=user, defaults={"option": option})
    return vote


@transaction.atomic
def set_vote(*, post: Post, user, value: int) -> Post:
    """Vote ↑ (1), ↓ (-1) ou retrait (0). Idempotent ; recalcule score et rangs."""
    if value not in (-1, 0, 1):
        raise DomainError("Vote invalide.", code="invalid_vote")
    # Verrou sur le post : deux votes simultanés ne faussent pas les compteurs.
    post = Post.objects.select_for_update().get(id=post.id)
    previous = PostLike.objects.filter(post=post, user=user).values_list("value", flat=True).first()
    if value == 0:
        PostLike.objects.filter(post=post, user=user).delete()
    else:
        PostLike.objects.update_or_create(post=post, user=user, defaults={"value": value})

    totals = PostLike.objects.filter(post=post).aggregate(
        score=Sum("value"), ups=Count("id", filter=Q(value=1))
    )
    post.score = totals["score"] or 0
    post.like_count = totals["ups"]
    post.hot, post.top = ranks(score=post.score, created_at=post.created_at)
    post.save(update_fields=["score", "like_count", "hot", "top", "updated_at"])

    if value != (previous or 0):
        transaction.on_commit(
            lambda: post_vote_changed.send(sender=Post, post_id=post.id, author_id=post.author_id)
        )
    if value == 1 and previous != 1 and post.author_id != user.id:
        transaction.on_commit(
            lambda: post_liked.send(
                sender=Post, post_id=post.id, author_id=post.author_id, user_id=user.id
            )
        )
    return post


def set_like(*, post: Post, user, liked: bool) -> Post:
    """Ancienne API « j'aime » (app mobile) : un vote ↑ ou son retrait."""
    return set_vote(post=post, user=user, value=1 if liked else 0)


def adjust_comment_count(*, post_id, delta: int) -> None:
    posts = Post.objects.filter(id=post_id)
    if delta < 0:
        posts = posts.filter(comment_count__gte=-delta)
    posts.update(comment_count=F("comment_count") + delta)


def apply_offline_write(*, user, op: str, record_id, data: dict) -> None:
    """Écriture rejouée depuis la copie locale (features/sync)."""
    if op == "PUT":
        create_post(
            author=user,
            post_id=record_id,
            kind=data.get("kind") or Post.Kind.TEXT,
            title=data.get("title") or "",
            body=data.get("body") or "",
            poll_options=parse_json_list(data.get("poll_options")),
            media_id=data.get("media_id") or None,
            tags=data.get("tags"),
            hub_id=data.get("hub_id") or None,
        )
        return
    post = Post.objects.alive().filter(id=record_id).first()
    if post is None:
        raise NotFoundError("Post introuvable.")
    if op == "PATCH":
        update_post(
            post=post,
            user=user,
            title=data.get("title"),
            body=data.get("body"),
            tags=data.get("tags"),
        )
    elif op == "DELETE":
        delete_post(post=post, user=user)
