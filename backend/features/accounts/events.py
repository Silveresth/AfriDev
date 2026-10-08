"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé (dans la transaction) à la création d'un compte, avec :
# user_id, username, display_name, avatar_url, github_username.
# `profiles` y crée le profil public.
user_registered = Signal()
