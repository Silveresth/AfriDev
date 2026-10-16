from django.urls import path

from .views import (
    CompleteUploadView,
    LocalUploadView,
    MediaDetailView,
    MediaUploadView,
    PresignUploadView,
)

app_name = "media"

urlpatterns = [
    path("", MediaUploadView.as_view(), name="upload"),
    path("presign-upload/", PresignUploadView.as_view(), name="presign-upload"),
    path("<uuid:asset_id>/", MediaDetailView.as_view(), name="detail"),
    path("<uuid:asset_id>/complete/", CompleteUploadView.as_view(), name="complete-upload"),
    path("<uuid:asset_id>/local-upload/", LocalUploadView.as_view(), name="local-upload"),
]
