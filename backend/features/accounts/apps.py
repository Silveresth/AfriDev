from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "features.accounts"
    label = "accounts"

    def ready(self):
        from . import schema  # noqa: F401  (décrit les authentifications dans l'OpenAPI)
