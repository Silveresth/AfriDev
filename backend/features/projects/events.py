"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec project_id, owner_id à la création ou modification (knowledge indexe).
project_saved = Signal()
# Envoyé après commit avec project_id.
project_deleted = Signal()
