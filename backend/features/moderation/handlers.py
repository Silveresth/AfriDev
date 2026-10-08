"""Écoute la publication de contenus pour les faire analyser par l'IA."""

from django.conf import settings
from django.dispatch import receiver

from features.discussions.events import comment_created
from features.feed.events import post_published
from features.qa.events import answer_created, question_created

from .tasks import ai_screen_content


def _screen(target_type: str, target_id, text: str) -> None:
    if settings.MODERATION_SCREEN_NEW_CONTENT and text:
        ai_screen_content.delay(target_type, str(target_id), text)


@receiver(post_published)
def on_post_published(sender, post_id, text, **kwargs):
    _screen("post", post_id, text)


@receiver(comment_created)
def on_comment_created(sender, comment_id, text, **kwargs):
    _screen("comment", comment_id, text)


@receiver(question_created)
def on_question_created(sender, question_id, text, **kwargs):
    _screen("question", question_id, text)


@receiver(answer_created)
def on_answer_created(sender, answer_id, text, **kwargs):
    _screen("answer", answer_id, text)
