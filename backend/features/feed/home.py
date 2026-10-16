"""Fil d'accueil mixte : posts, questions, snippets, projets et offres, dans une même liste.

Principe (pensé pour un petit VPS : quelques requêtes indexées bornées par page) :

1. La « recette » du membre (feed_mix, issue de l'accueil) fixe le quota de chaque type sur une
   page de 20 éléments. Un filtre (?filter=questions…) réserve toute la page à un seul type.
2. Pour chaque type, une requête récupère les plus récents avant son propre curseur
   (LIMIT quota × 2 dans le fil mixte, quota exact pour un filtre) : chaque type pagine
   indépendamment, rien n'est répété d'une page à l'autre.
3. Les candidats sont notés : fraîcheur, popularité, recouvrement avec les tags suivis,
   auteur suivi. On garde les meilleurs de chaque type, puis on complète avec les meilleurs
   restants si un type manque de contenu.
4. Les éléments sont entrelacés par score, sans jamais plus de deux du même type d'affilée.

Le curseur suivant (base64 JSON) mémorise, par type, la clé (date, id) du dernier candidat lu :
deux contenus publiés dans la même milliseconde ne sont ni sautés ni répétés.
Les candidats écartés d'une page « Pour vous » ne reviennent pas : ils restent visibles via les
filtres par type (tri chronologique) ou les pages dédiées.
"""

import base64
import binascii
import json
import math
import uuid
from datetime import datetime

from django.utils import timezone

from features.jobs_events import selectors as job_selectors
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

from . import selectors

PAGE_SIZE = 20
TYPES = ("post", "question", "snippet", "project", "job")
FILTERS = {
    "all": None,
    "posts": "post",
    "questions": "question",
    "snippets": "snippet",
    "projects": "project",
    "jobs": "job",
}
SCOPES = ("for_you", "following")
# Le fil d'accueil ne montre ni l'actu externe (colonne dédiée) ni les événements (widget) :
# leurs parts sont réparties sur les autres types ; les vidéos sont des posts.
_MIX_ALIASES = {"video": "post"}

_LOADERS = {
    "post": selectors.home_candidates,
    "question": qa_selectors.home_candidates,
    "snippet": snippet_selectors.home_candidates,
    "project": project_selectors.home_candidates,
    "job": job_selectors.home_candidates,
}


class InvalidCursor(ValueError):
    pass


def encode_cursor(positions: dict) -> str | None:
    if not positions:
        return None
    raw = json.dumps({kind: [at.isoformat(), str(pk)] for kind, (at, pk) in positions.items()})
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str | None) -> dict | None:
    """None = première page ; {type: (date, id)} : position de lecture de chaque type."""
    if not cursor:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        return {
            kind: (datetime.fromisoformat(at), uuid.UUID(pk))
            for kind, (at, pk) in data.items()
            if kind in TYPES
        }
    except (binascii.Error, ValueError, TypeError, AttributeError) as exc:
        raise InvalidCursor("Curseur invalide.") from exc


def quotas(mix: dict, only: str | None) -> dict[str, int]:
    """Nombre d'éléments de chaque type sur une page (au moins 1 pour chaque type présent)."""
    if only:
        return {only: PAGE_SIZE}
    shares: dict[str, float] = {}
    for kind, share in mix.items():
        kind = _MIX_ALIASES.get(kind, kind)
        if kind in TYPES:
            shares[kind] = shares.get(kind, 0) + share
    total = sum(shares.values()) or 1
    return {kind: max(1, round(PAGE_SIZE * share / total)) for kind, share in shares.items()}


def _score(card: dict, *, now, interests: set, following: set) -> float:
    hours = max(0.0, (now - card["sort_at"]).total_seconds() / 3600)
    freshness = 1 / (1 + hours / 24) ** 1.2  # moitié de la note après ~1 jour et demi
    popularity = math.log1p(max(0, card["popularity"])) / 4
    matched = len({str(tag).lower() for tag in card["tags"]} & interests)
    affinity = min(matched, 3) * 0.35
    social = 0.5 if card["author_id"] in following else 0.0
    return freshness + popularity + affinity + social


def _interleave(cards: list[dict]) -> list[dict]:
    """Par score décroissant, sans plus de deux éléments du même type d'affilée."""
    pending = sorted(cards, key=lambda card: -card["_score"])
    ordered: list[dict] = []
    while pending:
        streak = [card["type"] for card in ordered[-2:]]
        blocked = streak[0] if len(streak) == 2 and streak[0] == streak[1] else None
        index = next((i for i, card in enumerate(pending) if card["type"] != blocked), 0)
        ordered.append(pending.pop(index))
    return ordered


def home_page(*, viewer_id=None, filter: str = "all", scope: str = "for_you", cursor=None):
    """(cartes ordonnées, curseur suivant, tags suivis). Les cartes « post » portent leur Post."""
    only = FILTERS.get(filter)
    prefs = profile_selectors.feed_preferences(user_id=viewer_id)
    following = set(prefs["following"])
    author_ids = following if scope == "following" else None
    if scope == "following" and not following:
        return [], None, []

    positions = decode_cursor(cursor)
    plan = quotas(prefs["mix"], only)
    if positions is not None:
        # Pages suivantes : seuls les types qui ont encore du contenu.
        plan = {kind: count for kind, count in plan.items() if kind in positions}
    if not plan:
        return [], None, []

    now = timezone.now()
    interests = {str(tag).lower() for tag in prefs["interests"]}
    picked, spare, next_positions = [], [], {}
    for kind, quota in plan.items():
        # Fil mixte : 2× le quota pour choisir les plus pertinents. Filtre par type : lecture
        # exacte, rien n'est sauté d'une page à l'autre.
        limit = quota if only else quota * 2
        before = positions.get(kind) if positions else None
        candidates = _LOADERS[kind](before=before, limit=limit, author_ids=author_ids)
        if len(candidates) == limit:
            # Lus du plus récent au plus ancien : le dernier fixe la reprise de ce type.
            next_positions[kind] = (candidates[-1]["sort_at"], candidates[-1]["id"])
        for card in candidates:
            card["_score"] = _score(card, now=now, interests=interests, following=following)
        candidates.sort(key=lambda card: -card["_score"])
        picked += candidates[:quota]
        spare += candidates[quota:]

    # Un type à court de contenu : on complète avec les meilleurs candidats restants.
    missing = PAGE_SIZE - len(picked) if not only else 0
    if missing > 0 and spare:
        picked += sorted(spare, key=lambda card: -card["_score"])[:missing]
    return _interleave(picked), encode_cursor(next_positions), prefs["interests"]
