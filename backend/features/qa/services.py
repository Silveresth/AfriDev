"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.db import transaction
from django.db.models import F, Sum

from core import jobs
from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from core.utils import normalize_tags
from features.hubs import services as hub_services
from features.media import selectors as media_selectors
from features.snippets import selectors as snippet_selectors

from .events import (
    ai_answer_ready,
    answer_accepted,
    answer_created,
    answer_voted,
    question_created,
)
from .models import Answer, AnswerVote, Question


class SecretDetectedError(DomainError):
    code = "secret_detected"


def _guard(*texts: str) -> None:
    """Le Security Guard s'applique aussi aux questions : on y colle souvent du code."""
    for text in texts:
        findings = snippet_selectors.find_secrets(text or "")
        if findings:
            raise SecretDetectedError(
                f"Secret détecté ({findings[0].description}) à la ligne {findings[0].line}. "
                "Retirez-le avant de publier.",
                details={"findings": [f.__dict__ for f in findings]},
            )


# ── Questions ──


@transaction.atomic
def create_question(
    *,
    author,
    title: str,
    body: str,
    tags: list | None = None,
    audio_media_id=None,
    hub_id=None,
    question_id=None,
) -> Question:
    """`question_id` : identifiant généré hors ligne (rejouer l'envoi est sans effet)."""
    if question_id:
        existing = Question.objects.filter(id=question_id).first()
        if existing:
            if existing.author_id != author.id:
                raise PermissionDeniedError("Identifiant déjà utilisé.")
            return existing

    title, body = title.strip(), body.strip()
    if len(title) < 10:
        raise DomainError("Le titre doit faire au moins 10 caractères.", code="invalid_question")
    _guard(title, body)
    if audio_media_id and not media_selectors.get_owned_asset(
        asset_id=audio_media_id, owner_id=author.id, kind="audio"
    ):
        raise DomainError("Message vocal introuvable.", code="invalid_media")

    question = Question(
        author=author,
        title=title,
        body=body,
        tags=normalize_tags(tags),
        audio_media_id=audio_media_id or None,
        hub_id=hub_services.require_hub(hub_id=hub_id),
    )
    if question_id:
        question.id = question_id
    question.save()

    from .tasks import ai_answer_question, ai_tag_question

    transaction.on_commit(lambda: ai_answer_question.delay(str(question.id)))
    if not question.tags:
        transaction.on_commit(lambda: ai_tag_question.delay(str(question.id)))
    transaction.on_commit(
        lambda: question_created.send(
            sender=Question,
            question_id=question.id,
            author_id=question.author_id,
            text=f"{question.title}\n\n{question.body}",
        )
    )
    return question


@transaction.atomic
def update_question(*, question: Question, user, title=None, body=None, tags=None) -> Question:
    if question.author_id != user.id:
        raise PermissionDeniedError("Seul l'auteur peut modifier cette question.")
    fields = []
    if title is not None and title.strip() != question.title:
        question.title = title.strip()
        fields.append("title")
    if body is not None and body.strip() != question.body:
        question.body = body.strip()
        fields.append("body")
    if tags is not None:
        question.tags = normalize_tags(tags)
        fields.append("tags")
    if fields:
        _guard(question.title, question.body)
        question.save(update_fields=[*fields, "updated_at"])
    return question


def delete_question(*, question: Question, user) -> None:
    if question.author_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul l'auteur peut supprimer cette question.")
    question.soft_delete()


def hide_question(*, question_id) -> bool:
    question = Question.objects.alive().filter(id=question_id).first()
    if question:
        question.soft_delete()
    return question is not None


def set_tags(*, question_id, tags: list) -> None:
    Question.objects.filter(id=question_id, tags=[]).update(tags=normalize_tags(tags))


@transaction.atomic
def request_ai_answer(*, question: Question, user) -> Question:
    """Relance la réponse IA (après modification de la question ou un échec)."""
    if question.author_id != user.id:
        raise PermissionDeniedError("Seul l'auteur peut relancer la réponse IA.")
    from .tasks import ai_answer_question

    question.ai_answer_status = Question.AiStatus.PENDING
    question.save(update_fields=["ai_answer_status", "updated_at"])
    transaction.on_commit(lambda: ai_answer_question.delay(str(question.id), force=True))
    return question


def store_ai_answer(
    *, question_id, answer: str | None, sources: list[dict], disabled: bool = False
) -> None:
    """`disabled` : aucun fournisseur IA configuré (dev), à distinguer d'un échec."""
    question = Question.objects.alive().filter(id=question_id).first()
    if question is None:
        return
    if answer:
        question.ai_answer = answer
        question.ai_answer_sources = sources
        question.ai_answer_status = Question.AiStatus.READY
    else:
        question.ai_answer_status = (
            Question.AiStatus.DISABLED if disabled else Question.AiStatus.FAILED
        )
    question.save(
        update_fields=["ai_answer", "ai_answer_sources", "ai_answer_status", "updated_at"]
    )
    if answer:
        ai_answer_ready.send(sender=Question, question_id=question.id, author_id=question.author_id)


# ── Réponses ──


@transaction.atomic
def create_answer(*, author, question: Question, body: str, answer_id=None) -> Answer:
    if answer_id:
        existing = Answer.objects.filter(id=answer_id).first()
        if existing:
            if existing.author_id != author.id:
                raise PermissionDeniedError("Identifiant déjà utilisé.")
            return existing

    body = body.strip()
    if not body:
        raise DomainError("La réponse est vide.", code="invalid_answer")
    _guard(body)
    answer = Answer(question=question, author=author, body=body)
    if answer_id:
        answer.id = answer_id
    answer.save()
    Question.objects.filter(id=question.id).update(answer_count=F("answer_count") + 1)

    transaction.on_commit(
        lambda: answer_created.send(
            sender=Answer,
            answer_id=answer.id,
            question_id=question.id,
            author_id=author.id,
            question_author_id=question.author_id,
            text=body,
        )
    )
    return answer


def delete_answer(*, answer: Answer, user) -> None:
    if answer.author_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul l'auteur peut supprimer cette réponse.")
    _remove_answer(answer)


def hide_answer(*, answer_id) -> bool:
    answer = Answer.objects.alive().filter(id=answer_id).first()
    if answer:
        _remove_answer(answer)
    return answer is not None


def restore_question(*, question_id) -> bool:
    """Annule un masquage de la modération."""
    question = Question.objects.filter(id=question_id, deleted_at__isnull=False).first()
    if question:
        question.deleted_at = None
        question.save(update_fields=["deleted_at", "updated_at"])
    return question is not None


@transaction.atomic
def restore_answer(*, answer_id) -> bool:
    """Annule un masquage : la réponse recompte, et résout de nouveau la question si acceptée."""
    answer = Answer.objects.filter(id=answer_id, deleted_at__isnull=False).first()
    if answer is None:
        return False
    answer.deleted_at = None
    answer.save(update_fields=["deleted_at", "updated_at"])
    changes = {"answer_count": F("answer_count") + 1}
    if answer.is_accepted:
        changes["is_resolved"] = True
    Question.objects.filter(id=answer.question_id).update(**changes)
    return True


@transaction.atomic
def _remove_answer(answer: Answer) -> None:
    answer.soft_delete()
    Question.objects.filter(id=answer.question_id, answer_count__gt=0).update(
        answer_count=F("answer_count") - 1
    )
    if answer.is_accepted:
        Question.objects.filter(id=answer.question_id).update(is_resolved=False)


@transaction.atomic
def accept_answer(*, answer: Answer, user) -> Answer:
    question = answer.question
    if question.author_id != user.id:
        raise PermissionDeniedError("Seul l'auteur de la question peut accepter une réponse.")
    previous = Answer.objects.filter(question=question, is_accepted=True).exclude(id=answer.id)
    previous_author_ids = list(previous.values_list("author_id", flat=True))
    previous.update(is_accepted=False)
    answer.is_accepted = True
    answer.save(update_fields=["is_accepted", "updated_at"])
    question.is_resolved = True
    question.save(update_fields=["is_resolved", "updated_at"])
    transaction.on_commit(
        lambda: answer_accepted.send(
            sender=Answer,
            question_id=question.id,
            answer_id=answer.id,
            answer_author_id=answer.author_id,
            previous_author_ids=previous_author_ids,
        )
    )
    return answer


@transaction.atomic
def vote_answer(*, answer: Answer, user, value: int) -> Answer:
    """value : +1, -1, ou 0 pour retirer son vote."""
    if answer.author_id == user.id:
        raise DomainError("Impossible de voter pour sa propre réponse.", code="self_vote")
    if value == 0:
        AnswerVote.objects.filter(answer=answer, user=user).delete()
    else:
        AnswerVote.objects.update_or_create(
            answer=answer, user=user, defaults={"value": 1 if value > 0 else -1}
        )
    answer.score = AnswerVote.objects.filter(answer=answer).aggregate(s=Sum("value"))["s"] or 0
    answer.save(update_fields=["score", "updated_at"])
    transaction.on_commit(
        lambda: answer_voted.send(sender=Answer, answer_id=answer.id, author_id=answer.author_id)
    )
    return answer


# ── IA éphémère (résultat via /api/jobs/<id>/) ──


def request_rephrase(*, user, title: str, body: str) -> str:
    from .tasks import ai_rephrase

    _guard(title, body)
    return jobs.start_job(owner_id=user.id, task=ai_rephrase, title=title, body=body)


def request_transcription(*, user, media_id, language: str | None) -> str:
    from .tasks import ai_transcribe_voice

    if not media_selectors.get_owned_asset(asset_id=media_id, owner_id=user.id, kind="audio"):
        raise NotFoundError("Message vocal introuvable.")
    return jobs.start_job(
        owner_id=user.id, task=ai_transcribe_voice, media_id=str(media_id), language=language
    )


# ── Synchro hors ligne ──


def apply_offline_question(*, user, op: str, record_id, data: dict) -> None:
    if op == "PUT":
        create_question(
            author=user,
            question_id=record_id,
            title=data.get("title") or "",
            body=data.get("body") or "",
            tags=data.get("tags"),
            hub_id=data.get("hub_id") or None,
        )
        return
    question = Question.objects.alive().filter(id=record_id).first()
    if question is None:
        raise NotFoundError("Question introuvable.")
    if op == "PATCH":
        update_question(
            question=question,
            user=user,
            title=data.get("title"),
            body=data.get("body"),
            tags=data.get("tags"),
        )
    elif op == "DELETE":
        delete_question(question=question, user=user)


def apply_offline_answer(*, user, op: str, record_id, data: dict) -> None:
    if op == "PUT":
        question = Question.objects.alive().filter(id=data.get("question_id")).first()
        if question is None:
            raise NotFoundError("Question introuvable.")
        create_answer(
            author=user, question=question, body=data.get("body") or "", answer_id=record_id
        )
        return
    answer = Answer.objects.alive().filter(id=record_id).first()
    if answer is None:
        raise NotFoundError("Réponse introuvable.")
    if op == "DELETE":
        delete_answer(answer=answer, user=user)
    elif op == "PATCH":
        if "is_accepted" in data and data["is_accepted"]:
            accept_answer(answer=answer, user=user)
        elif data.get("body"):
            if answer.author_id != user.id:
                raise PermissionDeniedError("Seul l'auteur peut modifier cette réponse.")
            _guard(data["body"])
            answer.body = data["body"].strip()
            answer.save(update_fields=["body", "updated_at"])
