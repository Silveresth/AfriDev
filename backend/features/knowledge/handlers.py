"""Écoute les events des autres features pour alimenter l'index vectoriel (RAG)."""

from django.dispatch import receiver

from features.projects.events import project_deleted, project_saved
from features.qa.events import answer_accepted
from features.snippets.events import snippet_published, snippet_unpublished

from .models import Document
from .tasks import ai_index_project, ai_index_question, ai_index_snippet, remove_source


@receiver(snippet_published)
def on_snippet_published(sender, snippet_id, **kwargs):
    ai_index_snippet.delay(str(snippet_id))


@receiver(snippet_unpublished)
def on_snippet_unpublished(sender, snippet_id, **kwargs):
    remove_source.delay(Document.SourceType.SNIPPET, str(snippet_id))


@receiver(answer_accepted)
def on_answer_accepted(sender, question_id, **kwargs):
    ai_index_question.delay(str(question_id))


@receiver(project_saved)
def on_project_saved(sender, project_id, **kwargs):
    ai_index_project.delay(str(project_id))


@receiver(project_deleted)
def on_project_deleted(sender, project_id, **kwargs):
    remove_source.delay(Document.SourceType.PROJECT, str(project_id))
