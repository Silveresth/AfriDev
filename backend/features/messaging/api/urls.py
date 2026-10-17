from django.urls import path

from .views import (
    ClearConversationView,
    ConversationDetailView,
    ConversationListView,
    MarkReadView,
    MessageDeleteView,
    MessageDetailView,
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
    path(
        "conversations/<uuid:conversation_id>/messages/delete/",
        MessageDeleteView.as_view(),
        name="messages-delete",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/<uuid:message_id>/",
        MessageDetailView.as_view(),
        name="message",
    ),
    path("conversations/<uuid:conversation_id>/read/", MarkReadView.as_view(), name="read"),
    path(
        "conversations/<uuid:conversation_id>/clear/",
        ClearConversationView.as_view(),
        name="clear",
    ),
    path("unread/", UnreadMessagesView.as_view(), name="unread"),
]
