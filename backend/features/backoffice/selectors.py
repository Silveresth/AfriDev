"""Lectures du back-office : assemble les indicateurs publiés par chaque feature.

Aucun modèle propre : tout passe par les selectors des features propriétaires, pour que
chaque chiffre reste défini (et testé) là où vivent les données.
"""

from datetime import timedelta

from django.db.models import QuerySet
from django.utils import timezone

from features.accounts import selectors as account_selectors
from features.discussions import selectors as discussion_selectors
from features.feed import selectors as feed_selectors
from features.matchmaking import selectors as matchmaking_selectors
from features.moderation import selectors as moderation_selectors
from features.onboarding_agent import selectors as guide_selectors
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors
from features.sync import selectors as sync_selectors
from features.translation import selectors as translation_selectors
from integrations.llm import client as llm

PERIODS = (7, 30, 90)
# Les compteurs de jetons IA sont gardés 35 jours dans le cache.
AI_USAGE_MAX_DAYS = 35


def _timeline(*, days: int, since) -> list[dict]:
    signups = account_selectors.signups_per_day(since=since)
    posts = feed_selectors.posts_per_day(since=since)
    comments = discussion_selectors.comments_per_day(since=since)
    qa = qa_selectors.contributions_per_day(since=since)
    today = timezone.localdate()
    timeline = []
    for offset in range(days - 1, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        timeline.append(
            {
                "day": day,
                "signups": signups.get(day, 0),
                "posts": posts.get(day, 0),
                "comments": comments.get(day, 0),
                "qa": qa.get(day, 0),
            }
        )
    return timeline


def _ai_usage(*, days: int) -> dict:
    usage = llm.usage_by_day(days=min(days, AI_USAGE_MAX_DAYS))
    by_model: dict[str, dict[str, int]] = {}
    for models in usage.values():
        for model, tokens in models.items():
            total = by_model.setdefault(model, {"input": 0, "output": 0})
            total["input"] += tokens["input"]
            total["output"] += tokens["output"]
    return {
        "input_tokens": sum(tokens["input"] for tokens in by_model.values()),
        "output_tokens": sum(tokens["output"] for tokens in by_model.values()),
        "by_model": [{"model": model, **tokens} for model, tokens in sorted(by_model.items())],
        "days_covered": min(days, AI_USAGE_MAX_DAYS),
    }


def _unanswered(limit: int = 5) -> list[dict]:
    questions = list(qa_selectors.unanswered_questions(limit=limit))
    cards = profile_selectors.author_cards(user_ids={q.author_id for q in questions})
    return [
        {"id": q.id, "title": q.title, "created_at": q.created_at, "author": cards.get(q.author_id)}
        for q in questions
    ]


def dashboard(*, days: int = 30) -> dict:
    since = timezone.now() - timedelta(days=days)
    qa = qa_selectors.qa_stats(since=since)
    return {
        "period_days": days,
        "generated_at": timezone.now(),
        "members": account_selectors.user_stats(since=since),
        "content": {
            "posts": feed_selectors.post_stats(since=since),
            "comments": discussion_selectors.comment_stats(since=since),
            "qa": qa,
            "snippets": snippet_selectors.snippet_stats(since=since),
            "projects": project_selectors.project_stats(since=since),
            "applications": matchmaking_selectors.application_stats(since=since),
        },
        "moderation": moderation_selectors.report_stats(since=since),
        "ai": {
            "answers": qa["ai_answers"],
            "translations": translation_selectors.translation_stats(since=since)["new"],
            "guides": guide_selectors.guide_stats(since=since),
            "usage": _ai_usage(days=days),
        },
        "sync": sync_selectors.rejection_stats(since=since),
        "timeline": _timeline(days=days, since=since),
        "unanswered_questions": _unanswered(),
    }


def list_members(*, query: str = "", role: str | None = None) -> QuerySet:
    return account_selectors.search_accounts(query=query, role=role)


def get_member(*, user_id):
    return account_selectors.get_account(user_id=user_id)


def member_cards(*, users: list) -> dict:
    """{user_id: profil public} pour afficher nom et avatar à côté du compte."""
    return profile_selectors.author_cards(user_ids={user.id for user in users})
