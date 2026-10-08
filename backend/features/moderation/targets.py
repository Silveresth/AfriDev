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
from features.qa import selectors as qa_selectors
from features.qa import services as qa_services


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
}
