"""Gestion des contenus du back-office : une liste par type, sous une forme commune.

Lecture et écriture passent par les selectors / services des features propriétaires ; le
masquage des contenus signalables passe par la modération (signalements clos, auteur prévenu).
"""

from collections.abc import Callable
from dataclasses import dataclass

from core.exceptions import DomainError, NotFoundError
from features.feed import selectors as feed_selectors
from features.hubs import selectors as hub_selectors
from features.hubs import services as hub_services
from features.jobs_events import selectors as job_selectors
from features.jobs_events import services as job_services
from features.moderation import services as moderation_services
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

HIDDEN_BY_TEAM = "retiré par l'équipe AfriDev"


@dataclass(frozen=True)
class Kind:
    queryset: Callable
    row: Callable[[object], dict]
    # Masquage par la modération (post, question, snippet, projet, hub) ou retrait direct.
    moderated: bool = True


def _excerpt(text: str, size: int = 160) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= size else text[: size - 1] + "…"


KINDS: dict[str, Kind] = {
    "post": Kind(
        feed_selectors.admin_queryset,
        lambda p: {
            "title": p.title or _excerpt(p.body, 80) or "(sans titre)",
            "excerpt": _excerpt(p.body),
            "author_id": p.author_id,
            "url": f"/feed/{p.id}",
            "meta": {"score": p.score, "comments": p.comment_count, "kind": p.kind},
        },
    ),
    "question": Kind(
        qa_selectors.admin_queryset,
        lambda q: {
            "title": q.title,
            "excerpt": _excerpt(q.body),
            "author_id": q.author_id,
            "url": f"/questions/{q.id}",
            "meta": {"answers": q.answer_count, "resolved": q.is_resolved},
        },
    ),
    "snippet": Kind(
        snippet_selectors.admin_queryset,
        lambda s: {
            "title": s.title,
            "excerpt": _excerpt(s.content),
            "author_id": s.owner_id,
            "url": f"/snippets/{s.id}",
            "meta": {"language": s.language, "comments": s.comment_count},
        },
    ),
    "project": Kind(
        project_selectors.admin_queryset,
        lambda p: {
            "title": p.name,
            "excerpt": _excerpt(p.description),
            "author_id": p.owner_id,
            "url": f"/projects/{p.id}",
            "meta": {"stars": p.stars, "recruiting": p.is_recruiting, "repo": p.repo_url},
        },
    ),
    "hub": Kind(
        hub_selectors.admin_queryset,
        lambda h: {
            "title": h.name,
            "excerpt": _excerpt(h.description),
            "author_id": h.creator_id,
            "url": f"/h/{h.slug}",
            "meta": {"members": h.member_count, "verified": h.is_verified, "slug": h.slug},
        },
    ),
    "job": Kind(
        job_selectors.admin_jobs,
        lambda j: {
            "title": f"{j.title} · {j.company}",
            "excerpt": _excerpt(j.description),
            "author_id": j.author_id,
            "url": "/jobs",
            "meta": {"active": j.is_active, "location": j.location, "remote": j.is_remote},
        },
        moderated=False,
    ),
    "event": Kind(
        job_selectors.admin_events,
        lambda e: {
            "title": e.title,
            "excerpt": _excerpt(e.description),
            "author_id": e.author_id,
            "url": "/events",
            "meta": {"starts_at": e.starts_at.isoformat(), "organizer": e.organizer},
        },
        moderated=False,
    ),
}


def _kind(content_type: str) -> Kind:
    kind = KINDS.get(content_type)
    if kind is None:
        raise DomainError(f"Type de contenu inconnu : {content_type}.", code="invalid_type")
    return kind


def list_content(*, content_type: str, removed: bool = False, query: str = ""):
    return _kind(content_type).queryset(removed=removed, query=query)


def present(*, content_type: str, items) -> list[dict]:
    kind = _kind(content_type)
    rows = [{"obj": item, **kind.row(item)} for item in items]
    authors = profile_selectors.author_cards(user_ids={row["author_id"] for row in rows})
    return [
        {
            "id": row["obj"].id,
            "type": content_type,
            "title": row["title"],
            "excerpt": row["excerpt"],
            "url": row["url"],
            "author": authors.get(row["author_id"]),
            "created_at": row["obj"].created_at,
            "removed": row["obj"].deleted_at is not None,
            "meta": row["meta"],
        }
        for row in rows
    ]


def _find(content_type: str, content_id):
    item = list_content(content_type=content_type, removed=False).filter(id=content_id).first()
    return (
        item or list_content(content_type=content_type, removed=True).filter(id=content_id).first()
    )


def act(*, content_type: str, content_id, action: str, actor) -> dict:
    """hide / restore pour tous les types ; verify / unverify pour un hub."""
    kind = _kind(content_type)
    if _find(content_type, content_id) is None:
        raise NotFoundError("Contenu introuvable.")
    if action in ("verify", "unverify"):
        if content_type != "hub":
            raise DomainError("Seul un hub peut être certifié.", code="invalid_action")
        hub = hub_selectors.get_hub(hub_id=content_id)
        if hub is None:
            raise DomainError("Rétablissez le hub avant de le certifier.", code="hub_removed")
        hub_services.set_verified(hub=hub, user=actor, verified=action == "verify")
    elif action == "hide":
        if kind.moderated:
            moderation_services.hide_target(
                target_type=content_type,
                target_id=content_id,
                reason=HIDDEN_BY_TEAM,
                moderator=actor,
            )
        else:
            job_services.hide_item(kind=content_type, item_id=content_id)
    elif action == "restore":
        if kind.moderated:
            moderation_services.restore_target(
                target_type=content_type, target_id=content_id, moderator=actor
            )
        else:
            job_services.restore_item(kind=content_type, item_id=content_id)
    else:
        raise DomainError(
            "Action inconnue (hide, restore, verify, unverify).", code="invalid_action"
        )
    return present(content_type=content_type, items=[_find(content_type, content_id)])[0]
