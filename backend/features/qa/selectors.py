"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Count, Q, QuerySet

from core.stats import count_per_day, merge_daily
from core.utils import keyset_before

from .models import Answer, AnswerVote, Question


def list_questions(
    *,
    tag: str | None = None,
    author_id=None,
    resolved: bool | None = None,
    query: str | None = None,
    hub_id=None,
) -> QuerySet[Question]:
    questions = Question.objects.alive()
    if hub_id:
        questions = questions.filter(hub_id=hub_id)
    if tag:
        questions = questions.filter(tags__icontains=f'"{tag.lower()}"')
    if author_id:
        questions = questions.filter(author_id=author_id)
    if resolved is not None:
        questions = questions.filter(is_resolved=resolved)
    if query:
        questions = questions.filter(Q(title__icontains=query) | Q(body__icontains=query))
    return questions


def get_question(*, question_id, include_hidden: bool = False) -> Question | None:
    questions = Question.objects.all() if include_hidden else Question.objects.alive()
    return questions.filter(id=question_id).first()


def list_answers(*, question_id) -> QuerySet[Answer]:
    return (
        Answer.objects.alive()
        .filter(question_id=question_id)
        .order_by("-is_accepted", "-score", "created_at")
    )


def list_author_answers(*, author_id, accepted: bool | None = None) -> QuerySet[Answer]:
    """Historique d'entraide d'un membre : ses réponses avec le titre de la question (1 requête)."""
    answers = (
        Answer.objects.alive()
        .filter(author_id=author_id, question__deleted_at__isnull=True)
        .select_related("question")
        .only(
            "id",
            "body",
            "is_accepted",
            "score",
            "created_at",
            "question__id",
            "question__title",
            "question__is_resolved",
        )
    )
    if accepted is not None:
        answers = answers.filter(is_accepted=accepted)
    return answers


def get_answer(*, answer_id, include_hidden: bool = False) -> Answer | None:
    answers = Answer.objects.all() if include_hidden else Answer.objects.alive()
    return answers.select_related("question").filter(id=answer_id).first()


def get_resolved_thread(*, question_id) -> tuple[Question, str] | None:
    """(question, texte de la réponse acceptée) pour l'index RAG, None si non résolue."""
    question = get_question(question_id=question_id)
    if question is None or not question.is_resolved:
        return None
    accepted = list_answers(question_id=question_id).filter(is_accepted=True).first()
    return (question, accepted.body) if accepted else None


def qa_stats(*, since) -> dict:
    questions = Question.objects.alive()
    answers = Answer.objects.alive()
    ai = dict(questions.values_list("ai_answer_status").annotate(n=Count("id")).order_by())
    return {
        "questions": questions.count(),
        "new_questions": questions.filter(created_at__gte=since).count(),
        "unanswered": questions.filter(answer_count=0, is_resolved=False).count(),
        "resolved": questions.filter(is_resolved=True).count(),
        "answers": answers.count(),
        "new_answers": answers.filter(created_at__gte=since).count(),
        "ai_answers": ai,
    }


def unanswered_questions(*, limit: int = 5) -> QuerySet[Question]:
    """Questions sans réponse les plus anciennes : à pousser vers la communauté."""
    return (
        Question.objects.alive()
        .filter(answer_count=0, is_resolved=False)
        .order_by("created_at")[:limit]
    )


def contributions_per_day(*, since) -> dict[str, int]:
    """Questions + réponses publiées chaque jour."""
    return merge_daily(
        count_per_day(Question.objects.alive(), since=since),
        count_per_day(Answer.objects.alive(), since=since),
    )


def tag_counts(*, since) -> dict[str, int]:
    """{tag: nombre de questions} posées depuis `since`."""
    counts: dict[str, int] = {}
    for tags in (
        Question.objects.alive().filter(created_at__gte=since).values_list("tags", flat=True)
    ):
        for tag in tags or []:
            counts[tag] = counts.get(tag, 0) + 1
    return counts


def home_candidates(*, before=None, limit: int, author_ids=None) -> list[dict]:
    """Questions récentes pour le fil d'accueil mixte (une requête, index -created_at)."""
    questions = list_questions()
    if author_ids is not None:
        questions = questions.filter(author_id__in=list(author_ids))
    rows = keyset_before(questions, "created_at", before).only(
        "id", "title", "body", "tags", "author_id", "created_at", "is_resolved", "answer_count"
    )[:limit]
    return [
        {
            "type": "question",
            "id": q.id,
            "title": q.title,
            "excerpt": " ".join(q.body.split())[:220],
            "tags": list(q.tags or []),
            "author_id": q.author_id,
            "sort_at": q.created_at,
            "url": f"/questions/{q.id}",
            "popularity": q.answer_count,
            "meta": {"is_resolved": q.is_resolved, "answer_count": q.answer_count},
        }
        for q in rows
    ]


def question_summaries(*, question_ids) -> dict:
    """{question_id: {title, excerpt, author_id, created_at, is_resolved}}."""
    rows = Question.objects.alive().filter(id__in=list(question_ids))
    return {
        q.id: {
            "title": q.title,
            "excerpt": q.body[:200],
            "author_id": q.author_id,
            "created_at": q.created_at,
            "is_resolved": q.is_resolved,
        }
        for q in rows
    }


def _accepted_answers(author_id):
    # Une réponse acceptée à sa propre question ne compte pas (pas d'auto-récompense).
    return (
        Answer.objects.alive()
        .filter(author_id=author_id, is_accepted=True, question__deleted_at__isnull=True)
        .exclude(question__author_id=author_id)
    )


def accepted_answer_count(*, author_id) -> int:
    return _accepted_answers(author_id).count()


def accepted_answer_tags(*, author_id) -> dict[str, int]:
    """{tag: réponses acceptées sur des questions portant ce tag} (badges « Expert … »)."""
    counts: dict[str, int] = {}
    for tags in _accepted_answers(author_id).values_list("question__tags", flat=True):
        for tag in tags or []:
            counts[tag] = counts.get(tag, 0) + 1
    return counts


def answer_upvotes_received(*, author_id) -> int:
    """Votes ↑ reçus sur ses réponses en ligne (hors votes pour soi-même) : Craft Entraide."""
    return (
        AnswerVote.objects.filter(
            answer__author_id=author_id, answer__deleted_at__isnull=True, value=1
        )
        .exclude(user_id=author_id)
        .count()
    )


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD)."""
    return {
        "questions": list(
            Question.objects.filter(author_id=user_id).values(
                "id", "title", "body", "tags", "hub_id", "is_resolved", "created_at", "deleted_at"
            )
        ),
        "answers": list(
            Answer.objects.filter(author_id=user_id).values(
                "id", "question_id", "body", "is_accepted", "score", "created_at", "deleted_at"
            )
        ),
    }
