from django.apps import AppConfig


class AssistantConfig(AppConfig):
    """Assistant IA : correspondance offre ↔ profil, relecture de code, réponses suggérées,
    résumé du jour, détection d'arnaques, constitution d'équipe, recherche vocale."""

    name = "features.assistant"
    label = "assistant"

    def ready(self):
        from . import handlers  # noqa: F401
