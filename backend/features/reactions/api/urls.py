from django.urls import path

from .views import ReactionView

app_name = "reactions"

urlpatterns = [
    path(
        "<str:target_type>/<uuid:target_id>/",
        ReactionView.as_view(),
        name="vote",
    ),
]
