from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AIQuotaThrottle(UserRateThrottle):
    """Quota par utilisateur pour toutes les fonctions IA (taux « ai » dans les réglages)."""

    scope = "ai"


class OTPThrottle(AnonRateThrottle):
    """Limite les envois de SMS (coût et abus) par adresse IP."""

    scope = "otp"
