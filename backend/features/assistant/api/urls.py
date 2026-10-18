from django.urls import path

from .views import (
    ChatRepliesView,
    CodeReviewView,
    DigestView,
    JobMatchView,
    TeamInviteView,
    TeamView,
    VoiceSearchView,
)

app_name = "assistant"

urlpatterns = [
    path("job-match/", JobMatchView.as_view(), name="job-match"),
    path("code-review/", CodeReviewView.as_view(), name="code-review"),
    path("chat-replies/", ChatRepliesView.as_view(), name="chat-replies"),
    path("digest/", DigestView.as_view(), name="digest"),
    path("team/", TeamView.as_view(), name="team"),
    path("team/invite/", TeamInviteView.as_view(), name="team-invite"),
    path("voice-search/", VoiceSearchView.as_view(), name="voice-search"),
]
