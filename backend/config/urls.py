"""Routage racine : inclut seulement les urls de chaque feature."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import HealthView, JobStatusView
from features.feed.api.views import HubFeedView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/jobs/<uuid:job_id>/", JobStatusView.as_view(), name="job-status"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/accounts/", include("features.accounts.api.urls")),
    path("api/profiles/", include("features.profiles.api.urls")),
    path("api/feed/", include("features.feed.api.urls")),
    # Le fil d'un hub appartient au fil (features.feed) ; le reste de /api/hubs/ à features.hubs.
    path("api/hubs/<slug:slug>/feed/", HubFeedView.as_view(), name="hub-feed"),
    path("api/hubs/", include("features.hubs.api.urls")),
    path("api/bookmarks/", include("features.bookmarks.api.urls")),
    path("api/", include("features.jobs_events.api.urls")),  # /api/job-board/ et /api/events/
    path("api/discussions/", include("features.discussions.api.urls")),
    path("api/translation/", include("features.translation.api.urls")),
    path("api/qa/", include("features.qa.api.urls")),
    path("api/snippets/", include("features.snippets.api.urls")),
    path("api/knowledge/", include("features.knowledge.api.urls")),
    path("api/projects/", include("features.projects.api.urls")),
    path("api/matchmaking/", include("features.matchmaking.api.urls")),
    path("api/onboarding-agent/", include("features.onboarding_agent.api.urls")),
    path("api/sync/", include("features.sync.api.urls")),
    path("api/media/", include("features.media.api.urls")),
    path("api/notifications/", include("features.notifications.api.urls")),
    path("api/moderation/", include("features.moderation.api.urls")),
    path("api/backoffice/", include("features.backoffice.api.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
