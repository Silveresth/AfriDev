"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec comment_id, post_id, author_id, parent_author_id, text.
comment_created = Signal()
# Envoyé après commit avec comment_id, post_id.
comment_deleted = Signal()
# Envoyé après commit avec comment_id, post_id quand la modération rétablit un commentaire.
comment_restored = Signal()
