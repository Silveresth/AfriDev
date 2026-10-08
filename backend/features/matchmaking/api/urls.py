from django.urls import path

from .views import (
    AnswerApplicationView,
    ApplicationDetailView,
    ApplyView,
    MyApplicationsView,
    ProjectApplicationsView,
    RecommendedCandidatesView,
    RecommendedProjectsView,
)

app_name = "matchmaking"

urlpatterns = [
    path("projects/", RecommendedProjectsView.as_view(), name="recommended-projects"),
    path(
        "projects/<uuid:project_id>/candidates/",
        RecommendedCandidatesView.as_view(),
        name="recommended-candidates",
    ),
    path("projects/<uuid:project_id>/apply/", ApplyView.as_view(), name="apply"),
    path(
        "projects/<uuid:project_id>/applications/",
        ProjectApplicationsView.as_view(),
        name="project-applications",
    ),
    path("applications/mine/", MyApplicationsView.as_view(), name="my-applications"),
    path(
        "applications/<uuid:application_id>/",
        ApplicationDetailView.as_view(),
        name="application-detail",
    ),
    path(
        "applications/<uuid:application_id>/answer/",
        AnswerApplicationView.as_view(),
        name="application-answer",
    ),
]
