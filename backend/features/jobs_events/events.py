"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec job_id, author_id, text (détection d'arnaque au recrutement).
job_published = Signal()
