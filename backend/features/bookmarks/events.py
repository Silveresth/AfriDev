"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec owner_id, target_type, target_id, added (profiles recalcule le karma
# de l'auteur d'un snippet sauvegardé).
bookmark_changed = Signal()
