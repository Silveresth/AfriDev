"""Tâches Celery de l'assistant (préfixe ai_ : file « ai »)."""

import logging
import uuid
from datetime import timedelta

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.contrib.auth import get_user_model
from django.utils import timezone

from core import jobs
from features.hubs import selectors as hub_selectors
from features.jobs_events import selectors as jobs_selectors
from features.media import selectors as media_selectors
from features.messaging import selectors as messaging_selectors
from features.messaging import services as messaging_services
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors
from integrations import llm, transcription

from . import ai, services

logger = logging.getLogger(__name__)

UNAVAILABLE = "L'assistant IA est indisponible pour le moment. Réessayez dans un instant."
SCAM_MIN_CONFIDENCE = 0.75
DIGEST_MAX_USERS = 300


def _run(job_id: str, compute) -> None:
    try:
        jobs.finish_job(job_id, compute())
    except (llm.LLMError, SoftTimeLimitExceeded) as exc:
        logger.warning("Assistant IA indisponible : %s", exc)
        jobs.fail_job(job_id, UNAVAILABLE)


@shared_task
def ai_job_match(*, job_id: str, user_id: str, offer_id: str) -> None:
    """job_id : suivi du résultat (core.jobs) ; offer_id : l'offre d'emploi évaluée."""
    offer = jobs_selectors.get_job(job_id=offer_id)
    if offer is None:
        jobs.fail_job(job_id, "Offre introuvable.")
        return
    _run(job_id, lambda: ai.job_match(user_id=user_id, job=offer))


@shared_task
def ai_code_review(*, job_id: str, code: str, language: str) -> None:
    _run(job_id, lambda: ai.code_review(code=code, language=language))


@shared_task
def ai_chat_replies(*, job_id: str, user_id: str, conversation_id: str) -> None:
    conversation = messaging_selectors.get_conversation(
        conversation_id=conversation_id, user_id=user_id
    )
    if conversation is None:
        jobs.fail_job(job_id, "Conversation introuvable.")
        return
    # UUID et non texte : comparé aux sender_id des messages (« Moi » / « L'autre »).
    _run(job_id, lambda: ai.chat_replies(conversation=conversation, user_id=uuid.UUID(user_id)))


@shared_task
def ai_digest(*, job_id: str, user_id: str) -> None:
    def compute():
        digest = ai.digest(user_id=user_id)
        services.store_digest(user_id=user_id, digest=digest)
        return digest or {}

    _run(job_id, compute)


@shared_task
def send_daily_digests() -> int:
    """Chaque matin (Celery beat, file par défaut) : un résumé par membre actif sur 7 jours,
    chacun dans sa propre tâche IA (limite de durée par tâche)."""
    if not llm.is_configured():
        return 0
    since = timezone.now() - timedelta(days=7)
    user_ids = (
        get_user_model()
        .objects.filter(is_active=True, last_login__gte=since)
        .order_by("-last_login")
        .values_list("id", flat=True)[:DIGEST_MAX_USERS]
    )
    queued = 0
    for user_id in user_ids:
        if services.cached_digest(user_id=user_id) is None:
            ai_user_digest.delay(str(user_id))
            queued += 1
    return queued


@shared_task
def ai_user_digest(user_id: str) -> None:
    try:
        digest = ai.digest(user_id=user_id)
    except (llm.LLMError, SoftTimeLimitExceeded):
        logger.warning("Résumé du jour impossible pour %s", user_id)
        return
    services.store_digest(user_id=user_id, digest=digest)
    if digest:
        services.notify_digest(user_id=user_id, digest=digest)


@shared_task
def ai_screen_message(message_id: str, body: str) -> None:
    """Arnaque probable dans un message privé : avertissement montré au destinataire."""
    try:
        verdict = ai.scam_check(body)
    except llm.LLMError:
        return
    if verdict["scam"] and verdict["confidence"] >= SCAM_MIN_CONFIDENCE:
        messaging_services.set_risk_note(
            message_id=message_id,
            note=verdict["warning"]
            or "Prudence : ce message ressemble à une arnaque (paiement ou données demandés).",
        )


@shared_task
def ai_team(*, job_id: str, project_id: str) -> None:
    project = project_selectors.get_project(project_id=project_id)
    if project is None:
        jobs.fail_job(job_id, "Projet introuvable.")
        return
    tags = [*project.tags, *([project.language] if project.language else [])]
    pool = profile_selectors.team_candidates(
        tags=tags, exclude_user_ids=[project.owner_id], limit=25
    )
    if not pool:
        jobs.finish_job(job_id, {"candidates": [], "invitation": ""})
        return
    candidates_text = "\n".join(
        f"@{p.username} | stack : {', '.join(p.stack[:8])} | lieu : {p.location or '?'} | "
        f"disponible : {'oui' if p.open_to_work else 'non'} | réputation : {p.karma_score}"
        for p in pool
    )
    project_text = (
        f"{project.name}\nTechnologies : {', '.join(tags) or 'non précisées'}\n"
        f"Recrute : {'oui' if project.is_recruiting else 'non'}\n"
        f"{' '.join(project.description.split())[:1500]}"
    )

    def compute():
        result = ai.team(
            project_text=project_text,
            candidates_text=candidates_text,
            allowed={p.username.lower() for p in pool},
        )
        by_name = {p.username.lower(): p for p in pool}
        cards = profile_selectors.author_cards(
            user_ids=[by_name[c["username"].lower()].user_id for c in result["candidates"]]
        )
        for candidate in result["candidates"]:
            profile = by_name[candidate["username"].lower()]
            card = cards.get(profile.user_id) or {}
            candidate.update(
                {
                    "username": profile.username,
                    "display_name": card.get("display_name", profile.username),
                    "avatar_url": card.get("avatar_url", ""),
                    "stack": list(profile.stack[:5]),
                    "open_to_work": profile.open_to_work,
                }
            )
        return result

    _run(job_id, compute)


@shared_task
def ai_profile_review(*, job_id: str, user_id: str) -> None:
    _run(job_id, lambda: ai.profile_review(user_id=user_id))


@shared_task
def ai_ask(*, job_id: str, question: str, history: list) -> None:
    _run(job_id, lambda: ai.ask(question=question, history=history))


@shared_task
def ai_first_contributions(*, job_id: str, user_id: str) -> None:
    profile = profile_selectors.get_profile_for_user(user_id=user_id)
    tags = [*(profile.stack if profile else []), *(profile.interests if profile else [])]
    pool = project_selectors.contribution_pool(tags=tags, limit=30)
    if not pool:
        jobs.finish_job(job_id, {"picks": []})
        return

    def compute():
        picks = ai.first_contributions(user_id=user_id, issues=pool)
        return {
            "picks": [
                {
                    "issue_id": str(pick["issue"].id),
                    "number": pick["issue"].number,
                    "title": pick["issue"].title,
                    "url": pick["issue"].url,
                    "labels": list(pick["issue"].labels or [])[:5],
                    "labeled": pick["issue"].labeled,
                    "project": {
                        "id": str(pick["issue"].project.id),
                        "name": pick["issue"].project.name,
                        "language": pick["issue"].project.language,
                        "logo_url": pick["issue"].project.logo_url,
                    },
                    "level": pick["level"],
                    "why": pick["why"],
                    "first_step": pick["first_step"],
                }
                for pick in picks
            ]
        }

    _run(job_id, compute)


# Mots trop courts ou trop vagues pour chercher un hub à partir du titre.
_STOPWORDS = {"pour", "avec", "dans", "comment", "quel", "quelle", "votre", "notre", "cette"}


@shared_task
def ai_suggest_hubs(*, job_id: str, text: str, tags: list) -> None:
    words = [w.strip(".,;:!?()«»\"'").lower() for w in text.split()[:40]]
    keywords = [*tags, *[w for w in words if len(w) > 3 and w not in _STOPWORDS][:10]]
    # Hubs dont le nom ou la description évoque le post, complétés par les plus actifs.
    hubs = hub_selectors.suggested_hubs(tags=keywords, limit=20)

    def compute():
        return {
            "hubs": [
                {
                    "id": str(pick["hub"]["id"]),
                    "slug": pick["hub"]["slug"],
                    "name": pick["hub"]["name"],
                    "icon": pick["hub"]["icon"],
                    "is_verified": pick["hub"]["is_verified"],
                    "reason": pick["reason"],
                }
                for pick in ai.suggest_hubs(text=text, hubs=hubs)
            ]
        }

    _run(job_id, compute)


@shared_task
def ai_voice_search(*, job_id: str, media_id: str, language: str | None) -> None:
    original = media_selectors.read_original(asset_id=media_id)
    if original is None:
        jobs.fail_job(job_id, "Enregistrement introuvable.")
        return
    audio, filename = original
    try:
        text = transcription.transcribe(audio=audio, filename=filename, language=language)
    except transcription.TranscriptionError as exc:
        jobs.fail_job(job_id, str(exc))
        return
    except SoftTimeLimitExceeded:
        jobs.fail_job(job_id, "La transcription a pris trop de temps.")
        return
    if not text.strip():
        jobs.fail_job(job_id, "Je n'ai rien entendu. Réessayez en parlant près du micro.")
        return
    _run(job_id, lambda: {"text": text, **ai.voice_query(text)})
