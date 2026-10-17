from django.apps import AppConfig


class OnboardingAgentConfig(AppConfig):
    name = "features.onboarding_agent"
    label = "onboarding_agent"

    def ready(self):
        from . import handlers  # noqa: F401  (branche les récepteurs de signaux)
