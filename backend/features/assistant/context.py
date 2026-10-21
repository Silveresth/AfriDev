"""Données transmises aux prompts : lues uniquement via les selectors des autres features.

Chaque fonction renvoie du texte compact (le modèle facture au jeton) et jamais d'information
privée d'un autre membre (adresse e-mail, téléphone).
"""

from datetime import timedelta

from django.utils import timezone

from features.feed import selectors as feed_selectors
from features.jobs_events import selectors as jobs_selectors
from features.media import selectors as media_selectors
from features.messaging import selectors as messaging_selectors
from features.profiles import selectors as profile_selectors
from features.qa import selectors as qa_selectors

MEDIA_LABELS = {"image": "[photo]", "video": "[vidéo]", "audio": "[message vocal]"}


def member_profile(*, user_id) -> str:
    profile = profile_selectors.get_profile_for_user(user_id=user_id)
    if profile is None:
        return "Profil vide."
    github = profile_selectors.github_overview(profile=profile) or {}
    languages = [lang.get("name", "") for lang in github.get("top_languages", [])][:6]
    help_tags = list(qa_selectors.accepted_answer_tags(author_id=user_id))[:6]
    lines = [
        f"Nom : {profile.display_name or profile.username}",
        f"Niveau : {profile.experience_level or 'non précisé'}",
        f"Stack : {', '.join(profile.stack) or 'non précisée'}",
        f"Sujets suivis : {', '.join(profile.interests[:10]) or 'aucun'}",
        f"Langages GitHub : {', '.join(languages) or 'inconnus'}",
        f"Aide sur : {', '.join(help_tags) or 'rien encore'}",
        f"Lieu : {profile.location or 'non précisé'}",
        f"Disponible (Open to Work) : {'oui' if profile.open_to_work else 'non'}",
        f"Bio : {' '.join(profile.bio.split())[:500]}",
    ]
    return "\n".join(lines)


def job_offer(job) -> str:
    place = ", ".join(filter(None, [job.location, job.country])) or "non précisé"
    return "\n".join(
        [
            f"Poste : {job.title} chez {job.company}",
            f"Contrat : {job.contract_type} · Lieu : {place} · Télétravail : "
            f"{'oui' if job.is_remote else 'non'}",
            f"Technologies : {', '.join(job.stack) or 'non précisées'}",
            f"Salaire : {job.salary_range or 'non précisé'}",
            f"Description : {' '.join(job.description.split())[:3000]}",
        ]
    )


def numbered_code(code: str, language: str) -> str:
    lines = code.replace("\r\n", "\n").split("\n")[:400]
    body = "\n".join(f"{index + 1:>3} | {line}" for index, line in enumerate(lines))
    return f"Langage : {language or 'inconnu'}\n\n{body}"


def chat_history(*, conversation, user_id, limit: int = 12) -> str:
    messages = list(
        messaging_selectors.list_messages(conversation=conversation, user_id=user_id)
        .filter(revoked_at__isnull=True)
        .order_by("-created_at")[:limit]
    )
    media = media_selectors.describe_many(asset_ids={m.media_id for m in messages})
    lines = []
    for message in reversed(messages):
        who = "Moi" if message.sender_id == user_id else "L'autre"
        kind = (media.get(message.media_id) or {}).get("kind")
        text = " ".join(message.body.split())[:400]
        label = MEDIA_LABELS.get(kind, "")
        lines.append(f"{who} : {' '.join(filter(None, [label, text])) or '[message]'}")
    return "\n".join(lines)


def digest_facts(*, user_id) -> tuple[str, int]:
    """Faits du jour pour le résumé : (texte, nombre d'éléments utiles)."""
    profile = profile_selectors.get_profile_for_user(user_id=user_id)
    stack = {str(s).lower() for s in (profile.stack if profile else [])}
    interests = {str(s).lower() for s in (profile.interests if profile else [])} | stack
    facts: list[str] = []

    jobs = [
        job
        for job in jobs_selectors.list_jobs()[:60]
        if stack & {str(t).lower() for t in job.stack}
    ][:3]
    for job in jobs:
        facts.append(f"OFFRE compatible : {job.title} chez {job.company} — /jobs/{job.id}")

    for question in qa_selectors.unanswered_questions(limit=30):
        if interests & {str(t).lower() for t in question.tags or []}:
            facts.append(
                f"QUESTION sans réponse dans vos sujets : {question.title}"
                f" — /questions/{question.id}"
            )
            if sum(fact.startswith("QUESTION") for fact in facts) >= 2:
                break

    since = timezone.now() - timedelta(days=1)
    popular = sorted(
        (card for card in feed_selectors.home_candidates(limit=40) if card["sort_at"] >= since),
        key=lambda card: card["popularity"],
        reverse=True,
    )[:2]
    for card in popular:
        # Les candidats du fil portent le post complet (plus de titre ni d'extrait à plat).
        post = card["post"]
        label = post.title or post.body[:80] or "(sans titre)"
        facts.append(f"POST populaire : {label} — /feed/{post.id}")

    unread = messaging_selectors.unread_conversation_count(user_id=user_id)
    if unread:
        facts.append(f"MESSAGES : {unread} conversation(s) avec des messages non lus — /messages")
    new_followers = profile_selectors.new_followers_count(user_id=user_id, since=since)
    if new_followers:
        facts.append(f"ABONNÉS : {new_followers} nouvel(s) abonné(s) depuis hier — /profile")
    name = (profile.display_name or profile.username) if profile else "membre"
    return f"Membre : {name}\nStack : {', '.join(sorted(stack)) or 'non précisée'}\n\n" + "\n".join(
        facts
    ), len(facts)
