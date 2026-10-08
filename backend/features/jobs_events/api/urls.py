from django.urls import path

from .views import (
    EventDetailView,
    EventFacetsView,
    EventListCreateView,
    JobDetailView,
    JobFacetsView,
    JobListCreateView,
)

app_name = "jobs_events"

# Monté sur /api/ : /api/job-board/… et /api/events/…
# (/api/jobs/<id>/ est déjà pris par le suivi des tâches IA, core.views.JobStatusView).
urlpatterns = [
    path("job-board/", JobListCreateView.as_view(), name="jobs"),
    path("job-board/facets/", JobFacetsView.as_view(), name="job-facets"),
    path("job-board/<uuid:job_id>/", JobDetailView.as_view(), name="job"),
    path("events/", EventListCreateView.as_view(), name="events"),
    path("events/facets/", EventFacetsView.as_view(), name="event-facets"),
    path("events/<uuid:event_id>/", EventDetailView.as_view(), name="event"),
]
