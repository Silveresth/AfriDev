from django.urls import path

from .views import (
    DeviceView,
    MarkAllReadView,
    MarkReadView,
    NotificationDetailView,
    NotificationListView,
    PreferencesView,
    UnreadCountView,
)

app_name = "notifications"

urlpatterns = [
    path("", NotificationListView.as_view(), name="list"),
    path("unread-count/", UnreadCountView.as_view(), name="unread-count"),
    path("read-all/", MarkAllReadView.as_view(), name="read-all"),
    path("devices/", DeviceView.as_view(), name="devices"),
    path("preferences/", PreferencesView.as_view(), name="preferences"),
    path("<uuid:notification_id>/", NotificationDetailView.as_view(), name="detail"),
    path("<uuid:notification_id>/read/", MarkReadView.as_view(), name="read"),
]
