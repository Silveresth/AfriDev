from django.urls import path

from .views import (
    AIBioView,
    MyOnboardingSkipView,
    MyOnboardingView,
    MyPinnedView,
    MyPreferencesView,
    MyProfileView,
    MySuggestionsView,
    PeopleSearchView,
    ProfileEndorsementsView,
    ProfileFollowersView,
    ProfileFollowingView,
    ProfileFollowView,
    ProfileGitHubView,
    ProfileQRCodeView,
    ProfileUnfollowView,
    PublicProfileView,
)

app_name = "profiles"

urlpatterns = [
    path("me/", MyProfileView.as_view(), name="me"),
    path("me/ai-bio/", AIBioView.as_view(), name="ai-bio"),
    path("me/pinned/", MyPinnedView.as_view(), name="pinned"),
    path("me/onboarding/", MyOnboardingView.as_view(), name="onboarding"),
    path("me/onboarding/skip/", MyOnboardingSkipView.as_view(), name="onboarding-skip"),
    path("me/preferences/", MyPreferencesView.as_view(), name="preferences"),
    path("me/suggestions/", MySuggestionsView.as_view(), name="suggestions"),
    # Avant <username>/ : « search » est un pseudo réservé (accounts.services).
    path("search/", PeopleSearchView.as_view(), name="search"),
    path("<str:username>/", PublicProfileView.as_view(), name="public"),
    path("<str:username>/follow/", ProfileFollowView.as_view(), name="follow"),
    path("<str:username>/unfollow/", ProfileUnfollowView.as_view(), name="unfollow"),
    path("<str:username>/followers/", ProfileFollowersView.as_view(), name="followers"),
    path("<str:username>/following/", ProfileFollowingView.as_view(), name="following"),
    path("<str:username>/github/", ProfileGitHubView.as_view(), name="github"),
    path("<str:username>/endorsements/", ProfileEndorsementsView.as_view(), name="endorsements"),
    path("<str:username>/qr.svg", ProfileQRCodeView.as_view(), name="qr"),
]
