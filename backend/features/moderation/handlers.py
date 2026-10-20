"""Écoute la publication et la modification de contenus pour les faire modérer.

Deux niveaux : un filtre local instantané (insultes et injures haineuses certaines, sans IA),
puis l'analyse IA, qui juge le contexte. Une modification repasse par les deux : un texte publié
propre puis modifié en insulte ne doit pas échapper à la modération.
"""

from django.conf import settings
from django.dispatch import receiver

from features.discussions.events import comment_created, comment_edited, target_comment_created
from features.feed.events import post_edited, post_published
from features.jobs_events.events import job_published
from features.qa.events import answer_created, answer_edited, question_created, question_edited
from features.snippets.events import snippet_comment_created
from integrations import llm

from . import lexicon, services
from .tasks import ai_screen_content


def _screen(target_type: str, target_id, text: str) -> None:
    if not (text or "").strip():
        return
    # Injure certaine : masquée tout de suite, même sans service d'IA.
    verdict = lexicon.check(text)
    if verdict:
        services.flag_from_screening(target_type=target_type, target_id=target_id, verdict=verdict)
        return
    # Sans clé Groq, chaque publication ferait passer une tâche vouée à l'échec par Redis.
    if settings.MODERATION_SCREEN_NEW_CONTENT and llm.is_configured():
        ai_screen_content.delay(target_type, str(target_id), text)


@receiver(post_published)
def on_post_published(sender, post_id, text, **kwargs):
    _screen("post", post_id, text)


@receiver(post_edited)
def on_post_edited(sender, post_id, text, **kwargs):
    _screen("post", post_id, text)


@receiver(comment_created)
def on_comment_created(sender, comment_id, text, **kwargs):
    _screen("comment", comment_id, text)


@receiver(comment_edited)
def on_comment_edited(sender, comment_id, text, **kwargs):
    _screen("comment", comment_id, text)


@receiver(question_created)
def on_question_created(sender, question_id, text, **kwargs):
    _screen("question", question_id, text)


@receiver(question_edited)
def on_question_edited(sender, question_id, text, **kwargs):
    _screen("question", question_id, text)


@receiver(answer_created)
def on_answer_created(sender, answer_id, text, **kwargs):
    _screen("answer", answer_id, text)


@receiver(answer_edited)
def on_answer_edited(sender, answer_id, text, **kwargs):
    _screen("answer", answer_id, text)


@receiver(job_published)
def on_job_published(sender, job_id, text, **kwargs):
    """Faux recrutements (frais demandés, mobile money, faux recruteur) : signalés à l'équipe."""
    _screen("job", job_id, text)


@receiver(target_comment_created)
def on_target_comment_created(sender, comment_id, text, **kwargs):
    _screen("target_comment", comment_id, text)


@receiver(snippet_comment_created)
def on_snippet_comment_created(sender, comment_id, text, **kwargs):
    _screen("snippet_comment", comment_id, text)
