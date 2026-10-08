"""Écoute les events des autres features."""

from django.dispatch import receiver

from features.accounts.events import user_registered
from features.bookmarks.events import bookmark_changed
from features.feed.events import post_vote_changed
from features.qa.events import answer_accepted, answer_voted
from features.snippets import selectors as snippet_selectors

from . import services


@receiver(user_registered)
def on_user_registered(sender, user_id, username, display_name, avatar_url, github_username, **kw):
    services.create_profile(
        user_id=user_id,
        username=username,
        display_name=display_name,
        avatar_url=avatar_url,
        github_username=github_username,
    )


def _refresh(*user_ids) -> None:
    from .tasks import recompute_karma

    for user_id in {uid for uid in user_ids if uid}:
        recompute_karma.delay(str(user_id))


@receiver(post_vote_changed)
def on_post_vote_changed(sender, author_id, **kwargs):
    _refresh(author_id)


@receiver(answer_voted)
def on_answer_voted(sender, author_id, **kwargs):
    _refresh(author_id)


@receiver(answer_accepted)
def on_answer_accepted(sender, answer_author_id, previous_author_ids=(), **kwargs):
    _refresh(answer_author_id, *previous_author_ids)


@receiver(bookmark_changed)
def on_bookmark_changed(sender, target_type, target_id, **kwargs):
    if target_type == "snippet":
        _refresh(snippet_selectors.get_snippet_owner_id(snippet_id=target_id))
