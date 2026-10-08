from django.apps import AppConfig


class FeedConfig(AppConfig):
    name = "features.feed"
    label = "feed"

    def ready(self):
        from . import handlers  # noqa: F401  (branche les récepteurs de signaux)
