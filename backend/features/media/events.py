"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé avec asset_id, owner_id, kind quand les variantes sont prêtes.
media_ready = Signal()
