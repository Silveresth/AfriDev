from django.urls import path

from . import consumers

websocket_urlpatterns: list = [
    path("ws/discussions/<uuid:post_id>/", consumers.CommentsConsumer.as_asgi()),
]
