from .base import *  # noqa: F401,F403
from .base import CORS_ALLOWED_ORIGINS, SPECTACULAR_SETTINGS, env

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
# Domaine public, plus les noms internes : « backend » (appels du site côté serveur via
# http://backend:8000) et localhost (healthcheck du conteneur).
ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=env.list(
        "ALLOWED_HOSTS",
        default=["afridev.duckdns.org", "backend", "localhost", "127.0.0.1"],
    ),
)
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# nginx redirige déjà HTTP -> HTTPS. Côté Django, la redirection casserait les appels internes
# du site (http://backend:8000) : désactivée par défaut.
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=False)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# Origines de développement jamais acceptées en production, même si le .env les liste :
# elles servent aussi d'adresses de retour OAuth autorisées (le code y serait envoyé).
CORS_ALLOWED_ORIGINS = [
    origin
    for origin in CORS_ALLOWED_ORIGINS
    if not any(local in origin for local in ("localhost", "127.0.0.1", "0.0.0.0"))
]

# Schéma et documentation de l'API : réservés à l'équipe (inutiles au public, et une carte
# complète des points d'entrée pour un attaquant). Les clients utilisent le fichier versionné.
SPECTACULAR_SETTINGS = {
    **SPECTACULAR_SETTINGS,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"],
}
