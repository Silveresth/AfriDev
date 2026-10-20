"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec post_id, author_id, text (modération IA, notifications).
post_published = Signal()
# Envoyé avec post_id, author_id, user_id quand un post reçoit un like.
post_liked = Signal()
# Envoyé après commit avec post_id, author_id à chaque changement de vote ↑/↓ (karma).
post_vote_changed = Signal()
# Envoyé après commit avec post_id, text quand le titre ou le texte d'un post change.
post_edited = Signal()
