from django.apps import AppConfig


class ProfilesConfig(AppConfig):
    name = "features.profiles"
    label = "profiles"

    def ready(self):
        from . import handlers  # noqa: F401  (branche les récepteurs de signaux)
