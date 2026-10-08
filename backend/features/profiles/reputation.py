"""Karma et badges automatiques.

Barème : +5 par vote ↑ reçu (posts et réponses), +15 par réponse acceptée (hors réponse à
sa propre question), +10 par membre ayant enregistré l'un de ses snippets publics.
Le calcul repart toujours des données (idempotent) : un vote retiré fait baisser le karma.
"""

import math

from django.utils import timezone

POINTS = {"upvotes": 5, "accepted_answers": 15, "snippet_saves": 10}

MAJOR_CONTRIBUTOR_KARMA = 250
EXPERT_ACCEPTED_ANSWERS = 3
MAX_EXPERT_BADGES = 3
TOP_SHARE = 0.05


def karma_details(*, user_id) -> dict:
    # Imports locaux : ces features lisent elles-mêmes les profils (author_cards).
    from features.bookmarks import selectors as bookmark_selectors
    from features.feed import selectors as feed_selectors
    from features.qa import selectors as qa_selectors
    from features.snippets import selectors as snippet_selectors

    snippet_ids = snippet_selectors.public_snippet_ids(owner_id=user_id)
    return {
        "upvotes": feed_selectors.upvotes_received(author_id=user_id)
        + qa_selectors.answer_upvotes_received(author_id=user_id),
        "accepted_answers": qa_selectors.accepted_answer_count(author_id=user_id),
        "snippet_saves": bookmark_selectors.snippet_save_count(
            snippet_ids=snippet_ids, exclude_owner_id=user_id
        )
        if snippet_ids
        else 0,
    }


def karma_score(details: dict) -> int:
    return sum(POINTS[key] * details.get(key, 0) for key in POINTS)


def _is_top_helper(user_id) -> bool:
    """Dans les 5 % de membres ayant le plus de réponses acceptées (au moins une)."""
    from features.qa import selectors as qa_selectors

    counts = qa_selectors.accepted_counts_by_author()
    mine = counts.get(user_id, 0)
    if not mine:
        return False
    better = sum(1 for total in counts.values() if total > mine)
    return better < math.ceil(len(counts) * TOP_SHARE)


def compute_badges(*, user_id, karma: int) -> list[dict]:
    """[{code, label, description}] dans l'ordre d'affichage (le plus prestigieux d'abord)."""
    from features.qa import selectors as qa_selectors

    badges = []
    if _is_top_helper(user_id):
        badges.append(
            {
                "code": "top-5-entraide",
                "label": "Top 5 % Entraide",
                "description": "Parmi les 5 % de membres aux réponses les plus souvent acceptées.",
            }
        )
    if karma >= MAJOR_CONTRIBUTOR_KARMA:
        badges.append(
            {
                "code": "contributeur-majeur",
                "label": "Contributeur Majeur",
                "description": f"Plus de {MAJOR_CONTRIBUTOR_KARMA} points de karma.",
            }
        )
    tags = qa_selectors.accepted_answer_tags(author_id=user_id)
    experts = sorted(
        (tag for tag, total in tags.items() if total >= EXPERT_ACCEPTED_ANSWERS),
        key=lambda tag: (-tags[tag], tag),
    )[:MAX_EXPERT_BADGES]
    for tag in experts:
        name = tag.replace("-", " ").title()
        badges.append(
            {
                "code": f"expert-{tag}",
                "label": f"Expert {name}",
                "description": f"{tags[tag]} réponses acceptées sur des questions {name}.",
            }
        )
    return badges


def merge_awards(previous: list[dict], current: list[dict]) -> list[dict]:
    """Garde la date d'obtention des badges déjà acquis ; date les nouveaux."""
    awarded = {badge["code"]: badge.get("awarded_at") for badge in previous or []}
    now = timezone.now().isoformat()
    return [{**badge, "awarded_at": awarded.get(badge["code"]) or now} for badge in current]
