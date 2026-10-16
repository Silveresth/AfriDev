"""Contenus modérables : pour chaque type, comment lire son texte, son auteur, le masquer
et le rétablir.

Passe exclusivement par les selectors / services des features propriétaires.
"""

from collections.abc import Callable
from dataclasses import dataclass

from features.discussions import selectors as discussion_selectors
from features.discussions import services as discussion_services
from features.feed import selectors as feed_selectors
from features.feed import services as feed_services
from features.hubs import selectors as hub_selectors
from features.hubs import services as hub_services
from features.projects import selectors as project_selectors
from features.projects import services as project_services
from features.qa import selectors as qa_selectors
from features.qa import services as qa_services
from features.snippets import selectors as snippet_selectors
from features.snippets import services as snippet_services


@dataclass(frozen=True)
class Content:
    text: str
    author_id: object
    # Page du site où le contenu s'affiche (lien depuis le back-office).
    url: str = ""
    hidden: bool = False


@dataclass(frozen=True)
class Target:
    # load(target_id, include_hidden=False)
    load: Callable[..., Content | None]
    hide: Callable[[object], bool]
    restore: Callable[[object], bool]


def _post(target_id, include_hidden=False):
    post = feed_selectors.get_post(post_id=target_id, include_hidden=include_hidden)
    if post is None:
        return None
    return Content(post.body, post.author_id, f"/feed/{post.id}", post.deleted_at is not None)


def _comment(target_id, include_hidden=False):
    comment = discussion_selectors.get_comment(comment_id=target_id, include_hidden=include_hidden)
    if comment is None:
        return None
    url = f"/feed/{comment.post_id}"
    return Content(comment.body, comment.author_id, url, comment.deleted_at is not None)


def _question(target_id, include_hidden=False):
    question = qa_selectors.get_question(question_id=target_id, include_hidden=include_hidden)
    if question is None:
        return None
    return Content(
        f"{question.title}\n\n{question.body}",
        question.author_id,
        f"/questions/{question.id}",
        question.deleted_at is not None,
    )


def _answer(target_id, include_hidden=False):
    answer = qa_selectors.get_answer(answer_id=target_id, include_hidden=include_hidden)
    if answer is None:
        return None
    url = f"/questions/{answer.question_id}"
    return Content(answer.body, answer.author_id, url, answer.deleted_at is not None)


def _snippet(target_id, include_hidden=False):
    snippet = snippet_selectors.get_snippet(snippet_id=target_id, include_hidden=include_hidden)
    if snippet is None or not snippet.is_public:
        return None
    return Content(
        f"{snippet.title}\n\n{snippet.content}",
        snippet.owner_id,
        f"/snippets/{snippet.id}",
        snippet.deleted_at is not None,
    )


def _project(target_id, include_hidden=False):
    project = project_selectors.get_project(project_id=target_id, include_hidden=include_hidden)
    if project is None:
        return None
    return Content(
        f"{project.name}\n\n{project.description}",
        project.owner_id,
        f"/projects/{project.id}",
        project.deleted_at is not None,
    )


def _hub(target_id, include_hidden=False):
    hub = hub_selectors.get_hub(hub_id=target_id, include_hidden=include_hidden)
    if hub is None:
        return None
    return Content(
        f"{hub.name}\n\n{hub.description}",
        hub.creator_id,
        f"/h/{hub.slug}",
        hub.deleted_at is not None,
    )


TARGETS: dict[str, Target] = {
    "post": Target(
        load=_post,
        hide=lambda i: feed_services.hide_post(post_id=i),
        restore=lambda i: feed_services.restore_post(post_id=i),
    ),
    "comment": Target(
        load=_comment,
        hide=lambda i: discussion_services.hide_comment(comment_id=i),
        restore=lambda i: discussion_services.restore_comment(comment_id=i),
    ),
    "question": Target(
        load=_question,
        hide=lambda i: qa_services.hide_question(question_id=i),
        restore=lambda i: qa_services.restore_question(question_id=i),
    ),
    "answer": Target(
        load=_answer,
        hide=lambda i: qa_services.hide_answer(answer_id=i),
        restore=lambda i: qa_services.restore_answer(answer_id=i),
    ),
    "snippet": Target(
        load=_snippet,
        hide=lambda i: snippet_services.hide_snippet(snippet_id=i),
        restore=lambda i: snippet_services.restore_snippet(snippet_id=i),
    ),
    "project": Target(
        load=_project,
        hide=lambda i: project_services.hide_project(project_id=i),
        restore=lambda i: project_services.restore_project(project_id=i),
    ),
    "hub": Target(
        load=_hub,
        hide=lambda i: hub_services.hide_hub(hub_id=i),
        restore=lambda i: hub_services.restore_hub(hub_id=i),
    ),
}
