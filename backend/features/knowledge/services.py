"""Écritures : (ré)indexation des contenus des autres features, lus via leurs selectors."""

from features.projects import selectors as project_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

from . import indexer
from .models import Document


def index_snippet(*, snippet_id) -> None:
    snippet = snippet_selectors.get_public_snippet(snippet_id=snippet_id)
    if snippet is None:
        indexer.remove_document(source_type=Document.SourceType.SNIPPET, source_id=snippet_id)
        return
    tags = ", ".join(snippet.tags)
    indexer.index_document(
        source_type=Document.SourceType.SNIPPET,
        source_id=snippet.id,
        title=snippet.title,
        text=f"Langage : {snippet.language}\nTags : {tags}\n\n```{snippet.language}\n"
        f"{snippet.content}\n```",
        url=f"/snippets/{snippet.id}",
    )


def index_question(*, question_id) -> None:
    resolved = qa_selectors.get_resolved_thread(question_id=question_id)
    if resolved is None:
        indexer.remove_document(source_type=Document.SourceType.QUESTION, source_id=question_id)
        return
    question, answer_body = resolved
    indexer.index_document(
        source_type=Document.SourceType.QUESTION,
        source_id=question.id,
        title=question.title,
        text=f"{question.body}\n\nRéponse acceptée :\n{answer_body}",
        url=f"/questions/{question.id}",
    )


def index_project(*, project_id) -> None:
    project = project_selectors.get_project(project_id=project_id)
    if project is None:
        indexer.remove_document(source_type=Document.SourceType.PROJECT, source_id=project_id)
        return
    indexer.index_document(
        source_type=Document.SourceType.PROJECT,
        source_id=project.id,
        title=project.name,
        text=f"{project.description}\n\nTechnologies : {', '.join(project.tags)}\n"
        f"Dépôt : {project.repo_url}",
        url=f"/projects/{project.id}",
    )


def remove(*, source_type: str, source_id) -> None:
    indexer.remove_document(source_type=source_type, source_id=source_id)
