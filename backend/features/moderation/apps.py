from django.apps import AppConfig


class ModerationConfig(AppConfig):
    name = "features.moderation"
    label = "moderation"

    def ready(self):
        from . import handlers  # noqa: F401  (branche les récepteurs de signaux)
