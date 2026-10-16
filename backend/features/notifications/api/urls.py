from django.urls import path

from .views import (
    DeviceUnregisterView,
    DeviceView,
    MarkAllReadView,
    MarkReadView,
    NotificationDetailView,
    NotificationListView,
    PreferencesView,
    UnreadCountView,
    WebPushUnsubscribeView,
    WebPushView,
)

app_name = "notifications"

urlpatterns = [
    path("", NotificationListView.as_view(), name="list"),
    path("unread-count/", UnreadCountView.as_view(), name="unread-count"),
    path("read-all/", MarkAllReadView.as_view(), name="read-all"),
    path("devices/", DeviceView.as_view(), name="devices"),
    path("devices/unregister/", DeviceUnregisterView.as_view(), name="devices-unregister"),
    path("web-push/", WebPushView.as_view(), name="web-push"),
    path("web-push/unsubscribe/", WebPushUnsubscribeView.as_view(), name="web-push-unsubscribe"),
    path("preferences/", PreferencesView.as_view(), name="preferences"),
    path("<uuid:notification_id>/", NotificationDetailView.as_view(), name="detail"),
    path("<uuid:notification_id>/read/", MarkReadView.as_view(), name="read"),
]
