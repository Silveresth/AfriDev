from django.urls import path

from .views import (
    ContentActionView,
    ContentListView,
    DashboardView,
    MemberDetailView,
    MemberListView,
)

app_name = "backoffice"

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("members/", MemberListView.as_view(), name="members"),
    path("members/<uuid:user_id>/", MemberDetailView.as_view(), name="member"),
    path("content/", ContentListView.as_view(), name="content"),
    path(
        "content/<str:content_type>/<uuid:content_id>/",
        ContentActionView.as_view(),
        name="content-action",
    ),
]
