"""Réglages des tests : aucun service externe requis.

SQLite par défaut (TEST_DATABASE_URL pour tester sur PostgreSQL + pgvector, comme en CI),
cache et couche Channels en mémoire, Celery exécuté immédiatement.
"""

from .base import *  # noqa: F401,F403
from .base import BASE_DIR, env

DEBUG = False
SECRET_KEY = "test-secret-key-not-for-production-0123456789"
ALLOWED_HOSTS = ["*"]

DATABASES = {"default": env.db("TEST_DATABASE_URL", default="sqlite://:memory:")}

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = None

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Aucun appel réseau : les clients externes basculent sur leur mode local.
GROQ_API_KEY = ""
VOYAGE_API_KEY = ""
SMS_PROVIDER_API_KEY = ""
MEILISEARCH_URL = ""
EXPO_ACCESS_TOKEN = ""
FFMPEG_BINARY = "ffmpeg-absent-in-tests"
MEDIA_ROOT = BASE_DIR / ".test-media"
POWERSYNC_ALLOW_DEV_KEY = True
POWERSYNC_DEV_KEY_PATH = BASE_DIR / ".test-powersync-key.pem"

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {
        "user": "10000/hour",
        "anon": "10000/hour",
        "ai": "1000/day",
        "otp": "1000/hour",
    },
}
