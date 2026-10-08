from django.urls import path

from .views import (
    PublicSnippetDetailView,
    PublicSnippetListView,
    SecretScanView,
    SnippetDetailView,
    SnippetListCreateView,
    SnippetPublishView,
    SnippetUnpublishView,
    SnippetVersionsView,
)

app_name = "snippets"

urlpatterns = [
    path("", SnippetListCreateView.as_view(), name="list-create"),
    path("scan/", SecretScanView.as_view(), name="scan"),
    path("public/", PublicSnippetListView.as_view(), name="public-list"),
    path("public/<uuid:snippet_id>/", PublicSnippetDetailView.as_view(), name="public-detail"),
    path("<uuid:snippet_id>/", SnippetDetailView.as_view(), name="detail"),
    path("<uuid:snippet_id>/publish/", SnippetPublishView.as_view(), name="publish"),
    path("<uuid:snippet_id>/unpublish/", SnippetUnpublishView.as_view(), name="unpublish"),
    path("<uuid:snippet_id>/versions/", SnippetVersionsView.as_view(), name="versions"),
]
