from django.urls import path

from . import consumers

websocket_urlpatterns: list = [
    path("ws/notifications/", consumers.NotificationsConsumer.as_asgi()),
]
