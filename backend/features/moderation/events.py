"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé avec target_type, target_id, author_id, reason quand un contenu est masqué.
content_hidden = Signal()
