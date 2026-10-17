from django.urls import path

from .views import (
    CommentDetailView,
    CommentListCreateView,
    TargetCommentDetailView,
    TargetCommentListCreateView,
    ThreadSummaryView,
)

app_name = "discussions"

urlpatterns = [
    path("posts/<uuid:post_id>/comments/", CommentListCreateView.as_view(), name="comments"),
    path("posts/<uuid:post_id>/summary/", ThreadSummaryView.as_view(), name="summary"),
    path("comments/<uuid:comment_id>/", CommentDetailView.as_view(), name="comment-detail"),
    # Projets et offres d'emploi : /targets/project/<id>/comments/, /targets/job/<id>/comments/.
    path(
        "targets/<str:target_type>/<uuid:target_id>/comments/",
        TargetCommentListCreateView.as_view(),
        name="target-comments",
    ),
    path(
        "target-comments/<uuid:comment_id>/",
        TargetCommentDetailView.as_view(),
        name="target-comment-detail",
    ),
]
