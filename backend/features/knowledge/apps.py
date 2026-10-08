from django.apps import AppConfig


class KnowledgeConfig(AppConfig):
    name = "features.knowledge"
    label = "knowledge"

    def ready(self):
        from . import handlers  # noqa: F401  (branche les récepteurs de signaux)
