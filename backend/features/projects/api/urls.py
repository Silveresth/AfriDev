from django.urls import path

from .views import (
    GoodFirstIssuesView,
    ProjectDetailView,
    ProjectIssuesView,
    ProjectListCreateView,
    ProjectSyncView,
)

app_name = "projects"

urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="list-create"),
    path("good-first-issues/", GoodFirstIssuesView.as_view(), name="good-first-issues"),
    path("<uuid:project_id>/", ProjectDetailView.as_view(), name="detail"),
    path("<uuid:project_id>/sync/", ProjectSyncView.as_view(), name="sync"),
    path("<uuid:project_id>/issues/", ProjectIssuesView.as_view(), name="issues"),
]
