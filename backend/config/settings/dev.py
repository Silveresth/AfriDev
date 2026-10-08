from .base import *  # noqa: F401,F403
from .base import BASE_DIR, env

DEBUG = True
ALLOWED_HOSTS = ["*"]
POWERSYNC_ALLOW_DEV_KEY = True
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://localhost:8081"],
)
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
# Derrière un tunnel (cloudflared, ngrok : `pnpm mobile:tunnel`), la requête d'origine est en
# HTTPS : les URL absolues (retour OAuth de l'appli mobile) doivent l'être aussi.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Mode léger (DJANGO_LITE=1) : lance l'API sans Docker, PostgreSQL ni Redis.
# SQLite, cache et temps réel en mémoire, tâches Celery exécutées immédiatement.
# Un seul processus : suffisant pour développer le web et le mobile, pas pour la production.
if env.bool("DJANGO_LITE", default=False):
    DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = None
