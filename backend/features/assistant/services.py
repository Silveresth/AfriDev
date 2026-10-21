"""Écritures et demandes IA. Chaque demande vérifie les droits puis lance une tâche de la file
« ai » ; le client suit le résultat via GET /api/jobs/<job_id>/ (core.jobs)."""

from datetime import date

from django.core.cache import cache
from django.db import transaction

from core import jobs
from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from features.jobs_events import selectors as jobs_selectors
from features.media import selectors as media_selectors
from features.messaging import selectors as messaging_selectors
from features.messaging import services as messaging_services
from features.notifications import services as notification_services
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors
from features.snippets import selectors as snippet_selectors
from integrations import llm

MAX_CODE = 12_000
DIGEST_TTL = 26 * 3600


def _require_ai() -> None:
    if not llm.is_configured():
        raise DomainError("L'assistant IA n'est pas configuré sur ce serveur.", code="ai_disabled")


# ── 1. Correspondance offre ↔ profil ──


def request_job_match(*, user, job_id) -> str:
    from .tasks import ai_job_match

    _require_ai()
    if jobs_selectors.get_job(job_id=job_id) is None:
        raise NotFoundError("Offre introuvable.")
    return jobs.start_job(
        owner_id=user.id, task=ai_job_match, user_id=str(user.id), offer_id=str(job_id)
    )


# ── 3. Relecture de code ──


def request_code_review(*, user, snippet_id=None, code: str = "", language: str = "") -> str:
    from .tasks import ai_code_review

    _require_ai()
    if snippet_id:
        snippet = snippet_selectors.get_public_snippet(snippet_id=snippet_id) or (
            snippet_selectors.get_owned_snippet(snippet_id=snippet_id, owner=user)
        )
        if snippet is None:
            raise NotFoundError("Snippet introuvable.")
        code, language = snippet.content, snippet.language
    code = (code or "").strip()
    if len(code) < 10:
        raise DomainError("Collez au moins quelques lignes de code.", code="code_too_short")
    if len(code) > MAX_CODE:
        raise DomainError(f"{MAX_CODE} caractères au maximum.", code="code_too_long")
    return jobs.start_job(owner_id=user.id, task=ai_code_review, code=code, language=language or "")


# ── 4. Réponses suggérées dans le chat ──


def request_chat_replies(*, user, conversation_id) -> str:
    from .tasks import ai_chat_replies

    _require_ai()
    if (
        messaging_selectors.get_conversation(conversation_id=conversation_id, user_id=user.id)
        is None
    ):
        raise NotFoundError("Conversation introuvable.")
    return jobs.start_job(
        owner_id=user.id,
        task=ai_chat_replies,
        user_id=str(user.id),
        conversation_id=str(conversation_id),
    )


# ── 5. Résumé du jour ──


def digest_key(user_id, day: date | None = None) -> str:
    return f"assistant:digest:{user_id}:{(day or date.today()).isoformat()}"


def cached_digest(*, user_id) -> dict | None:
    return cache.get(digest_key(user_id))


def store_digest(*, user_id, digest: dict | None) -> None:
    # {} : rien à signaler aujourd'hui (évite de relancer l'IA à chaque ouverture).
    cache.set(digest_key(user_id), digest or {}, DIGEST_TTL)


def request_digest(*, user) -> str:
    from .tasks import ai_digest

    _require_ai()
    return jobs.start_job(owner_id=user.id, task=ai_digest, user_id=str(user.id))


def notify_digest(*, user_id, digest: dict) -> None:
    first = digest["items"][0]["text"] if digest.get("items") else ""
    notification_services.notify(
        recipient_id=user_id,
        kind="daily_digest",
        title=digest["headline"],
        body=first,
        data={"type": "digest", "id": date.today().isoformat()},
    )


# ── 7. Constitution d'équipe ──


def _owned_project(*, user, project_id):
    project = project_selectors.get_project(project_id=project_id)
    if project is None:
        raise NotFoundError("Projet introuvable.")
    if project.owner_id != user.id and not user.is_staff:
        raise PermissionDeniedError("Seul le porteur du projet peut constituer l'équipe.")
    return project


def request_team(*, user, project_id) -> str:
    from .tasks import ai_team

    _require_ai()
    _owned_project(user=user, project_id=project_id)
    return jobs.start_job(owner_id=user.id, task=ai_team, project_id=str(project_id))


@transaction.atomic
def invite_teammate(*, user, project_id, username: str, message: str) -> None:
    """Invitation : message privé (avec le lien du projet) et notification au membre."""
    project = _owned_project(user=user, project_id=project_id)
    profile = profile_selectors.get_profile_by_username(username=username)
    if profile is None:
        raise NotFoundError("Membre introuvable.")
    if profile.user_id == user.id:
        raise DomainError("Vous faites déjà partie du projet.", code="self_invite")
    body = (message or "").strip()[
        :1500
    ] or f"Bonjour ! Rejoindriez-vous le projet {project.name} ?"
    conversation = messaging_services.open_conversation(user=user, other_user_id=profile.user_id)
    messaging_services.send_message(
        conversation=conversation, sender=user, body=f"{body}\n\n/projects/{project.id}"
    )
    notification_services.notify(
        recipient_id=profile.user_id,
        kind="team_invite",
        title=f"Invitation à rejoindre {project.name}"[:120],
        body=body[:300],
        data={"type": "project", "id": str(project.id)},
    )


# ── 9. Analyse du profil et du compte GitHub ──


def request_profile_review(*, user) -> str:
    from .tasks import ai_profile_review

    _require_ai()
    if profile_selectors.get_profile_for_user(user_id=user.id) is None:
        raise NotFoundError("Profil introuvable.")
    return jobs.start_job(owner_id=user.id, task=ai_profile_review, user_id=str(user.id))


# ── 10. « Demande à AfriDev » (réponses appuyées sur la plateforme) ──

MAX_QUESTION = 1000
MAX_HISTORY = 6


def request_ask(*, user, question: str, history: list | None = None) -> str:
    from .tasks import ai_ask

    _require_ai()
    question = " ".join((question or "").split())
    if len(question) < 3:
        raise DomainError("Posez une question d'au moins quelques mots.", code="question_too_short")
    turns = [
        {"role": turn["role"], "content": str(turn["content"])[:1000]}
        for turn in (history or [])[-MAX_HISTORY:]
        if isinstance(turn, dict)
        and turn.get("role") in {"user", "assistant"}
        and turn.get("content")
    ]
    return jobs.start_job(
        owner_id=user.id, task=ai_ask, question=question[:MAX_QUESTION], history=turns
    )


# ── 11. Premières contributions open source ──


def request_first_contributions(*, user) -> str:
    from .tasks import ai_first_contributions

    _require_ai()
    return jobs.start_job(owner_id=user.id, task=ai_first_contributions, user_id=str(user.id))


# ── 12. Hub suggéré pour un post ──


def request_hub_suggestions(*, user, title: str, body: str = "", tags: list | None = None) -> str:
    from .tasks import ai_suggest_hubs

    _require_ai()
    text = f"{(title or '').strip()}\n\n{(body or '').strip()}".strip()
    if len(text) < 10:
        raise DomainError("Écrivez d'abord le titre du post.", code="post_too_short")
    return jobs.start_job(
        owner_id=user.id,
        task=ai_suggest_hubs,
        text=text[:1500],
        tags=[str(tag)[:30] for tag in (tags or [])][:8],
    )


# ── 8. Recherche vocale ──


def request_voice_search(*, user, media_id, language: str | None) -> str:
    from .tasks import ai_voice_search

    _require_ai()
    if not media_selectors.get_owned_asset(asset_id=media_id, owner_id=user.id, kind="audio"):
        raise NotFoundError("Enregistrement introuvable.")
    return jobs.start_job(
        owner_id=user.id, task=ai_voice_search, media_id=str(media_id), language=language
    )
