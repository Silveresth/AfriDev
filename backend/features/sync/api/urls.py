from django.urls import path

from .views import (
    JWKSView,
    PowerSyncTokenView,
    RejectionAcknowledgeView,
    RejectionListView,
    UploadView,
)

app_name = "sync"

urlpatterns = [
    path("token/", PowerSyncTokenView.as_view(), name="token"),
    path("jwks/", JWKSView.as_view(), name="jwks"),
    path("upload/", UploadView.as_view(), name="upload"),
    path("rejections/", RejectionListView.as_view(), name="rejections"),
    path("rejections/ack/", RejectionAcknowledgeView.as_view(), name="rejections-ack"),
]
