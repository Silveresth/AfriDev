"""Écoute les events des autres features."""

from django.dispatch import receiver

from features.discussions.events import comment_created, comment_deleted, comment_restored

from . import services


@receiver(comment_created)
@receiver(comment_restored)
def on_comment_created(sender, post_id, **kwargs):
    services.adjust_comment_count(post_id=post_id, delta=1)


@receiver(comment_deleted)
def on_comment_deleted(sender, post_id, **kwargs):
    services.adjust_comment_count(post_id=post_id, delta=-1)
