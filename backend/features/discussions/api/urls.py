from django.urls import path

from .views import CommentDetailView, CommentListCreateView, ThreadSummaryView

app_name = "discussions"

urlpatterns = [
    path("posts/<uuid:post_id>/comments/", CommentListCreateView.as_view(), name="comments"),
    path("posts/<uuid:post_id>/summary/", ThreadSummaryView.as_view(), name="summary"),
    path("comments/<uuid:comment_id>/", CommentDetailView.as_view(), name="comment-detail"),
]
