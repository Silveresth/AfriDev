"""Écoute les events des autres features et prévient les personnes concernées.

`data` = {"type": <post|question|snippet|project|guide>, "id": ...} : le client en déduit l'écran.
"""

from django.dispatch import receiver

from features.discussions.events import comment_created
from features.feed import selectors as feed_selectors
from features.feed.events import post_liked
from features.matchmaking.events import application_answered, application_submitted
from features.moderation.events import content_hidden
from features.onboarding_agent.events import guide_finished
from features.profiles import selectors as profile_selectors
from features.qa.events import ai_answer_ready, answer_accepted, answer_created
from features.snippets.events import snippet_flagged

from .models import Notification
from .services import notify

Kind = Notification.Kind


def _name(user_id) -> str:
    card = profile_selectors.author_cards(user_ids=[user_id]).get(user_id)
    return card["display_name"] if card else "Quelqu'un"


def _excerpt(text: str, size: int = 120) -> str:
    text = " ".join(text.split())
    return text if len(text) <= size else text[: size - 1] + "…"


@receiver(comment_created)
def on_comment_created(sender, comment_id, post_id, author_id, parent_author_id, text, **kw):
    data = {"type": "post", "id": str(post_id), "comment_id": str(comment_id)}
    post_author_id = feed_selectors.get_post_author_id(post_id=post_id)
    if post_author_id and post_author_id != author_id:
        notify(
            recipient_id=post_author_id,
            kind=Kind.NEW_COMMENT,
            title=f"{_name(author_id)} a commenté votre post",
            body=_excerpt(text),
            data=data,
        )
    if parent_author_id and parent_author_id not in (author_id, post_author_id):
        notify(
            recipient_id=parent_author_id,
            kind=Kind.COMMENT_REPLY,
            title=f"{_name(author_id)} vous a répondu",
            body=_excerpt(text),
            data=data,
        )


@receiver(post_liked)
def on_post_liked(sender, post_id, author_id, user_id, **kwargs):
    notify(
        recipient_id=author_id,
        kind=Kind.POST_LIKED,
        title=f"{_name(user_id)} aime votre post",
        data={"type": "post", "id": str(post_id)},
    )


@receiver(answer_created)
def on_answer_created(sender, answer_id, question_id, author_id, question_author_id, text, **kw):
    if question_author_id == author_id:
        return
    notify(
        recipient_id=question_author_id,
        kind=Kind.NEW_ANSWER,
        title=f"{_name(author_id)} a répondu à votre question",
        body=_excerpt(text),
        data={"type": "question", "id": str(question_id), "answer_id": str(answer_id)},
    )


@receiver(answer_accepted)
def on_answer_accepted(sender, question_id, answer_id, answer_author_id, **kwargs):
    notify(
        recipient_id=answer_author_id,
        kind=Kind.ANSWER_ACCEPTED,
        title="Votre réponse a été acceptée 🎉",
        body="Elle rejoint la base de connaissances de la communauté.",
        data={"type": "question", "id": str(question_id), "answer_id": str(answer_id)},
    )


@receiver(ai_answer_ready)
def on_ai_answer_ready(sender, question_id, author_id, **kwargs):
    notify(
        recipient_id=author_id,
        kind=Kind.AI_ANSWER_READY,
        title="Une première réponse IA est prête",
        body="En attendant la communauté, voici une piste.",
        data={"type": "question", "id": str(question_id)},
    )


@receiver(snippet_flagged)
def on_snippet_flagged(sender, snippet_id, owner_id, reasons, **kwargs):
    notify(
        recipient_id=owner_id,
        kind=Kind.SNIPPET_FLAGGED,
        title="Snippet repassé en privé",
        body=_excerpt("Donnée sensible probable : " + "; ".join(reasons), 300),
        data={"type": "snippet", "id": str(snippet_id)},
    )


@receiver(content_hidden)
def on_content_hidden(sender, target_type, target_id, author_id, reason, **kwargs):
    notify(
        recipient_id=author_id,
        kind=Kind.CONTENT_HIDDEN,
        title="Un de vos contenus a été masqué",
        body=f"Motif : {reason}. Contactez la modération si c'est une erreur.",
        data={"type": target_type, "id": str(target_id)},
    )


@receiver(guide_finished)
def on_guide_finished(sender, guide_id, user_id, repo_url, ready, **kwargs):
    notify(
        recipient_id=user_id,
        kind=Kind.GUIDE_READY,
        title="Votre guide d'onboarding est prêt" if ready else "Guide d'onboarding impossible",
        body=repo_url,
        data={"type": "guide", "id": str(guide_id)},
    )


@receiver(application_submitted)
def on_application_submitted(
    sender, application_id, project_id, project_name, project_owner_id, candidate_id, **kw
):
    notify(
        recipient_id=project_owner_id,
        kind=Kind.APPLICATION_RECEIVED,
        title=f"{_name(candidate_id)} veut contribuer à {project_name}",
        data={"type": "project", "id": str(project_id), "application_id": str(application_id)},
    )


@receiver(application_answered)
def on_application_answered(
    sender, application_id, project_id, project_name, candidate_id, accepted, **kwargs
):
    verdict = "acceptée" if accepted else "déclinée"
    notify(
        recipient_id=candidate_id,
        kind=Kind.APPLICATION_ANSWERED,
        title=f"Candidature {verdict} : {project_name}",
        data={"type": "project", "id": str(project_id), "application_id": str(application_id)},
    )
