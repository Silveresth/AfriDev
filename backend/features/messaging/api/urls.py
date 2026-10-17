from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListView,
    MarkReadView,
    MessageListView,
    UnreadMessagesView,
)

app_name = "messaging"

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversations"),
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        MessageListView.as_view(),
        name="messages",
    ),
    path("conversations/<uuid:conversation_id>/read/", MarkReadView.as_view(), name="read"),
    path("unread/", UnreadMessagesView.as_view(), name="unread"),
]
