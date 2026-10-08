"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé avec guide_id, user_id, repo_url, ready (bool) quand l'agent a terminé.
guide_finished = Signal()
