"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé avec user_id quand la stack ou la bio change (matchmaking invalide son cache).
profile_updated = Signal()
