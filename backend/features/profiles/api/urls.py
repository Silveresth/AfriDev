from django.urls import path

from .views import (
    AIBioView,
    MyPinnedView,
    MyProfileView,
    ProfileEndorsementsView,
    ProfileGitHubView,
    ProfileQRCodeView,
    PublicProfileView,
)

app_name = "profiles"

urlpatterns = [
    path("me/", MyProfileView.as_view(), name="me"),
    path("me/ai-bio/", AIBioView.as_view(), name="ai-bio"),
    path("me/pinned/", MyPinnedView.as_view(), name="pinned"),
    path("<str:username>/", PublicProfileView.as_view(), name="public"),
    path("<str:username>/github/", ProfileGitHubView.as_view(), name="github"),
    path("<str:username>/endorsements/", ProfileEndorsementsView.as_view(), name="endorsements"),
    path("<str:username>/qr.svg", ProfileQRCodeView.as_view(), name="qr"),
]
