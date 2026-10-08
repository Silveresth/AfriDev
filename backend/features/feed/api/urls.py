from django.urls import path

from .views import (
    CommunitiesView,
    FeedView,
    PollVoteView,
    PostDetailView,
    PostLikeView,
    PostVoteView,
    TechNewsView,
)

app_name = "feed"

urlpatterns = [
    path("", FeedView.as_view(), name="list-create"),
    path("communities/", CommunitiesView.as_view(), name="communities"),
    path("news/", TechNewsView.as_view(), name="news"),
    path("<uuid:post_id>/", PostDetailView.as_view(), name="detail"),
    # /vote/ = choix d'un sondage (historique) ; /score/ = vote ↑/↓ du post.
    path("<uuid:post_id>/vote/", PollVoteView.as_view(), name="vote"),
    path("<uuid:post_id>/score/", PostVoteView.as_view(), name="score"),
    path("<uuid:post_id>/like/", PostLikeView.as_view(), name="like"),
]
