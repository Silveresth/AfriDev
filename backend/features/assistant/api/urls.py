from django.urls import path

from .views import (
    AskView,
    ChatRepliesView,
    CodeReviewView,
    DigestView,
    FirstContributionsView,
    HubSuggestView,
    JobMatchView,
    ProfileReviewView,
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
    path("profile-review/", ProfileReviewView.as_view(), name="profile-review"),
    path("ask/", AskView.as_view(), name="ask"),
    path("first-contributions/", FirstContributionsView.as_view(), name="first-contributions"),
    path("hub-suggest/", HubSuggestView.as_view(), name="hub-suggest"),
]
