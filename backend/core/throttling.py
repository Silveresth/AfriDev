from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AIQuotaThrottle(UserRateThrottle):
    """Quota par utilisateur pour toutes les fonctions IA (taux « ai » dans les réglages)."""

    scope = "ai"


class SemanticSearchThrottle(UserRateThrottle):
    """Recherche par le sens, ouverte aux visiteurs : par utilisateur, sinon par adresse IP."""

    scope = "semantic"


class LinkPreviewThrottle(UserRateThrottle):
    """Aperçus de liens (visionneuse interne) : par utilisateur, sinon par adresse IP."""

    scope = "link_preview"


class EmailThrottle(UserRateThrottle):
    """Renvoi de l'e-mail de confirmation : même quota que les SMS, par membre."""

    scope = "otp"


class OTPThrottle(AnonRateThrottle):
    """Limite les envois de SMS (coût et abus) par adresse IP."""

    scope = "otp"
