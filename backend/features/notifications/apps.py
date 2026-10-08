from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    name = "features.notifications"
    label = "notifications"

    def ready(self):
        from . import handlers  # noqa: F401  (branche les récepteurs de signaux)
