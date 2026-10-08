"""Réglages communs à tous les environnements."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REPO_DIR = BASE_DIR.parent

env = environ.Env()
environ.Env.read_env(REPO_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    # Tiers
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "corsheaders",
    "channels",
    # Socle
    "core",
    # Features
    "features.accounts",
    "features.profiles",
    "features.feed",
    "features.discussions",
    "features.translation",
    "features.qa",
    "features.snippets",
    "features.knowledge",
    "features.projects",
    "features.matchmaking",
    "features.onboarding_agent",
    "features.sync",
    "features.media",
    "features.notifications",
    "features.moderation",
    "features.backoffice",
    "features.hubs",
    "features.bookmarks",
    "features.jobs_events",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.db(
        "DATABASE_URL", default="postgres://postgres:postgres@localhost:5432/afridev"
    ),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "fr"
LANGUAGES = [("fr", "Français"), ("en", "English")]
TIME_ZONE = "Africa/Lome"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ── Redis : cache, Celery, Channels ──
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_ROUTES = {
    "features.*.tasks.ai_*": {"queue": "ai"},
    "features.accounts.tasks.*": {"queue": "sms"},
    "features.projects.tasks.*": {"queue": "github"},
}
CELERY_TASK_DEFAULT_QUEUE = "default"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ── API ──
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Jetons d'accès personnels (afd_…), puis JWT liés à une session révocable.
        "features.accounts.authentication.PersonalAccessTokenAuthentication",
        "features.accounts.authentication.SessionJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.CursorPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {
        "user": "1000/hour",
        "anon": "100/hour",
        "ai": env("AI_QUOTA_PER_DAY", default="50/day"),
        "otp": env("OTP_QUOTA", default="5/hour"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    # Refuse le renouvellement d'une session révoquée (réglages > Sécurité & sessions).
    "TOKEN_REFRESH_SERIALIZER": "features.accounts.api.serializers.SessionTokenRefreshSerializer",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "AfriDev Exchange API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Plusieurs features exposent un champ « status » : on nomme les énumérations explicitement.
    "ENUM_NAME_OVERRIDES": {
        "AiAnswerStatusEnum": "features.qa.models.Question.AiStatus",
        "MediaStatusEnum": "features.media.models.MediaAsset.Status",
        "ReportStatusEnum": "features.moderation.models.Report.Status",
        "GuideStatusEnum": "features.onboarding_agent.models.OnboardingGuide.Status",
        "TranslationStatusEnum": "features.translation.models.Translation.Status",
        "ApplicationStatusEnum": "features.matchmaking.models.ProjectApplication.Status",
        "PostKindEnum": "features.feed.models.Post.Kind",
        "MediaKindEnum": "features.media.models.MediaAsset.Kind",
        "NotificationKindEnum": "features.notifications.models.Notification.Kind",
        "ContractTypeEnum": "features.jobs_events.models.JobOffer.Contract",
        "EventKindEnum": "features.jobs_events.models.TechEvent.Kind",
        "TargetTypeEnum": "features.moderation.models.Report.TargetType",
        "BookmarkTargetTypeEnum": "features.bookmarks.api.serializers.TARGET_TYPES",
        "PinTargetTypeEnum": "features.profiles.api.serializers.PIN_TYPES",
    },
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# URL du site web (cible des QR codes de profil et des liens dans les e-mails).
PUBLIC_WEB_URL = env("PUBLIC_WEB_URL", default="http://localhost:3000")

# ── Services externes ──
# IA : Groq (API compatible OpenAI). Les modèles restent configurables car Groq
# fait évoluer son catalogue.
GROQ_API_KEY = env("GROQ_API_KEY", default="")
# Réponse instantanée (RAG), bio IA, agent d'onboarding.
GROQ_SMART_MODEL = env("GROQ_SMART_MODEL", default="llama-3.3-70b-versatile")
# Tâches rapides : tags, doublons, modération, résumé en 3 points, traduction.
GROQ_FAST_MODEL = env("GROQ_FAST_MODEL", default="llama-3.1-8b-instant")
# Questions vocales (Whisper hébergé par Groq).
GROQ_TRANSCRIPTION_MODEL = env("GROQ_TRANSCRIPTION_MODEL", default="whisper-large-v3-turbo")
# Durée du cache des réponses IA (secondes).
LLM_CACHE_SECONDS = env.int("LLM_CACHE_SECONDS", default=60 * 60 * 24 * 7)

VOYAGE_API_KEY = env("VOYAGE_API_KEY", default="")
VOYAGE_MODEL = env("VOYAGE_MODEL", default="voyage-3.5-lite")

GITHUB_TOKEN = env("GITHUB_TOKEN", default="")
GITHUB_CLIENT_ID = env("GITHUB_CLIENT_ID", default="")
GITHUB_CLIENT_SECRET = env("GITHUB_CLIENT_SECRET", default="")
GITLAB_URL = env("GITLAB_URL", default="https://gitlab.com")
GITLAB_CLIENT_ID = env("GITLAB_CLIENT_ID", default="")
GITLAB_CLIENT_SECRET = env("GITLAB_CLIENT_SECRET", default="")
OAUTH_REDIRECT_URI = env("OAUTH_REDIRECT_URI", default="http://localhost:3000/oauth/callback")
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET", default="")
# Adresse publique de l'API (https://api.exemple.com) : base de l'URL de retour OAuth de
# l'appli mobile. Vide : déduite de la requête (développement).
API_PUBLIC_URL = env("API_PUBLIC_URL", default="")

# SMS : Africa's Talking (« sandbox » comme nom d'utilisateur pour les tests).
SMS_PROVIDER_API_KEY = env("SMS_PROVIDER_API_KEY", default="")
SMS_PROVIDER_USERNAME = env("SMS_PROVIDER_USERNAME", default="sandbox")
SMS_SENDER_ID = env("SMS_SENDER_ID", default="")
OTP_TTL_SECONDS = env.int("OTP_TTL_SECONDS", default=300)
OTP_MAX_ATTEMPTS = env.int("OTP_MAX_ATTEMPTS", default=5)

PAYMENTS_PROVIDER_API_KEY = env("PAYMENTS_PROVIDER_API_KEY", default="")

MEILISEARCH_URL = env("MEILISEARCH_URL", default="")
MEILISEARCH_KEY = env("MEILISEARCH_KEY", default="")

POWERSYNC_URL = env("POWERSYNC_URL", default="http://localhost:8080")
POWERSYNC_JWT_PRIVATE_KEY = env("POWERSYNC_JWT_PRIVATE_KEY", default="")
POWERSYNC_JWT_KID = env("POWERSYNC_JWT_KID", default="afridev-powersync")
# En dev, sans clé fournie, une clé RSA est générée une fois et gardée dans ce fichier.
POWERSYNC_ALLOW_DEV_KEY = DEBUG
POWERSYNC_DEV_KEY_PATH = BASE_DIR / ".powersync_dev_key.pem"

# Médias : URL publique (CDN) devant le stockage ; vide = URLs Django locales.
MEDIA_CDN_URL = env("MEDIA_CDN_URL", default="")
MEDIA_MAX_UPLOAD_MB = env.int("MEDIA_MAX_UPLOAD_MB", default=50)
FFMPEG_BINARY = env("FFMPEG_BINARY", default="ffmpeg")
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# Notifications push (Expo).
EXPO_PUSH_URL = env("EXPO_PUSH_URL", default="https://exp.host/--/api/v2/push/send")
EXPO_ACCESS_TOKEN = env("EXPO_ACCESS_TOKEN", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="AfriDev Exchange <no-reply@afridev.dev>")

# Modération : nombre de signalements qui masque un contenu en attendant un modérateur.
MODERATION_AUTO_HIDE_REPORTS = env.int("MODERATION_AUTO_HIDE_REPORTS", default=3)
# Analyse IA de chaque nouveau contenu (posts, commentaires, questions, réponses).
MODERATION_SCREEN_NEW_CONTENT = env.bool("MODERATION_SCREEN_NEW_CONTENT", default=True)
# Confiance minimale de l'IA pour masquer un contenu sans attendre un modérateur.
MODERATION_AI_HIDE_CONFIDENCE = env.float("MODERATION_AI_HIDE_CONFIDENCE", default=0.9)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", default="INFO")},
}

# Règles anti-secrets partagées avec le web et le mobile (source unique).
SECURITY_GUARD_RULES_PATH = env(
    "SECURITY_GUARD_RULES_PATH",
    default=str(REPO_DIR / "packages" / "validation" / "src" / "security-guard" / "rules.json"),
)
