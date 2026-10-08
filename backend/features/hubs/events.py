"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec hub_id, user_id quand un membre rejoint un hub.
hub_joined = Signal()
