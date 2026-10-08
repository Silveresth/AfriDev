from django.urls import path

from .views import MediaDetailView, MediaUploadView

app_name = "media"

urlpatterns = [
    path("", MediaUploadView.as_view(), name="upload"),
    path("<uuid:asset_id>/", MediaDetailView.as_view(), name="detail"),
]
