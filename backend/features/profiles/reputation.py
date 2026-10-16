"""Craft Score (ex-« karma ») et badges automatiques.

Deux jauges, recalculées à partir des données (idempotent : un vote retiré fait baisser le score) :

- Craft Entraide : +5 par vote ↑ reçu sur ses réponses, +15 par réponse acceptée
  (hors réponse à sa propre question).
- Craft Création : +5 par vote ↑ reçu sur ses posts, +10 par membre ayant mis en favori
  l'un de ses snippets publics.

Craft Score global = somme pondérée des deux jauges (stocké dans la colonne `karma_score`,
conservée pour la rétrocompatibilité).
"""

import math

from django.utils import timezone

HELP_POINTS = {"answer_upvotes": 5, "accepted_answers": 15}
CREATION_POINTS = {"post_upvotes": 5, "snippet_saves": 10}
WEIGHTS = {"help": 1.0, "creation": 1.0}

MAJOR_CONTRIBUTOR_SCORE = 250
TOP_SHARE = 0.05
MENTOR_ACCEPTED_ANSWERS = 10
# Lead Contributor : favoris reçus sur ses snippets publics, ou étoiles de ses projets open-source.
LEAD_SNIPPET_SAVES = 20
LEAD_PROJECT_STARS = 50
EXPERT_ACCEPTED_ANSWERS = 3
MAX_EXPERT_BADGES = 3


def craft_details(*, user_id) -> dict:
    """Compteurs bruts des deux jauges (+ « upvotes » cumulé, ancien format du karma)."""
    # Imports locaux : ces features lisent elles-mêmes les profils (author_cards).
    from features.bookmarks import selectors as bookmark_selectors
    from features.feed import selectors as feed_selectors
    from features.projects import selectors as project_selectors
    from features.qa import selectors as qa_selectors
    from features.snippets import selectors as snippet_selectors

    snippet_ids = snippet_selectors.public_snippet_ids(owner_id=user_id)
    details = {
        "answer_upvotes": qa_selectors.answer_upvotes_received(author_id=user_id),
        "accepted_answers": qa_selectors.accepted_answer_count(author_id=user_id),
        "post_upvotes": feed_selectors.upvotes_received(author_id=user_id),
        "snippet_saves": bookmark_selectors.snippet_save_count(
            snippet_ids=snippet_ids, exclude_owner_id=user_id
        )
        if snippet_ids
        else 0,
        "project_stars": project_selectors.stars_received(owner_id=user_id),
    }
    details["upvotes"] = details["answer_upvotes"] + details["post_upvotes"]
    return details


def help_score(details: dict) -> int:
    return sum(points * details.get(key, 0) for key, points in HELP_POINTS.items())


def creation_score(details: dict) -> int:
    return sum(points * details.get(key, 0) for key, points in CREATION_POINTS.items())


def craft_score(*, entraide: int, creation: int) -> int:
    return round(entraide * WEIGHTS["help"] + creation * WEIGHTS["creation"])


def _is_top_helper(*, entraide: int) -> bool:
    """Dans les 5 % de membres à la plus forte jauge Entraide (parmi ceux qui en ont une).

    Deux COUNT sur la colonne indexée `craft_help`, au lieu d'agréger toutes les réponses.
    """
    from .models import Profile

    if entraide <= 0:
        return False
    helpers = Profile.objects.alive().filter(craft_help__gt=0)
    better = helpers.filter(craft_help__gt=entraide).count()
    return better < math.ceil(helpers.count() * TOP_SHARE)


def _badge(code: str, label: str, description: str) -> dict:
    return {"code": code, "label": label, "description": description}


def compute_badges(*, user_id, details: dict, entraide: int, score: int) -> list[dict]:
    """[{code, label, description}] dans l'ordre d'affichage (le plus prestigieux d'abord)."""
    from features.qa import selectors as qa_selectors

    badges = []
    top_helper = _is_top_helper(entraide=entraide)
    if top_helper and details.get("accepted_answers", 0) >= MENTOR_ACCEPTED_ANSWERS:
        badges.append(
            _badge(
                "mentor-communautaire",
                "Mentor Communautaire",
                f"Top 5 % de l'entraide, plus de {MENTOR_ACCEPTED_ANSWERS} réponses acceptées.",
            )
        )
    if (
        details.get("snippet_saves", 0) >= LEAD_SNIPPET_SAVES
        or details.get("project_stars", 0) >= LEAD_PROJECT_STARS
    ):
        badges.append(
            _badge(
                "lead-contributor",
                "Lead Contributor",
                "Snippets et projets open-source largement adoptés par la communauté.",
            )
        )
    if top_helper:
        badges.append(
            _badge(
                "top-5-entraide",
                "Top 5 % Entraide",
                "Parmi les 5 % de membres qui aident le plus la communauté.",
            )
        )
    if score >= MAJOR_CONTRIBUTOR_SCORE:
        badges.append(
            _badge(
                "contributeur-majeur",
                "Contributeur Majeur",
                f"Plus de {MAJOR_CONTRIBUTOR_SCORE} points de Craft.",
            )
        )
    tags = qa_selectors.accepted_answer_tags(author_id=user_id)
    experts = sorted(
        (tag for tag, total in tags.items() if total >= EXPERT_ACCEPTED_ANSWERS),
        key=lambda tag: (-tags[tag], tag),
    )[:MAX_EXPERT_BADGES]
    for tag in experts:
        name = tag.replace("-", " ").title()
        badges.append(
            _badge(
                f"expert-{tag}",
                f"Expert {name}",
                f"{tags[tag]} réponses acceptées sur des questions {name}.",
            )
        )
    return badges


def merge_awards(previous: list[dict], current: list[dict]) -> list[dict]:
    """Garde la date d'obtention des badges déjà acquis ; date les nouveaux."""
    awarded = {badge["code"]: badge.get("awarded_at") for badge in previous or []}
    now = timezone.now().isoformat()
    return [{**badge, "awarded_at": awarded.get(badge["code"]) or now} for badge in current]
