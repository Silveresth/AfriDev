from django.urls import path

from .views import (
    CollectionDetailView,
    CollectionItemsView,
    CollectionListCreateView,
    ItemDetailView,
    QuickSaveView,
    SavedTargetsView,
)

app_name = "bookmarks"

urlpatterns = [
    path("collections/", CollectionListCreateView.as_view(), name="collections"),
    path("collections/<uuid:collection_id>/", CollectionDetailView.as_view(), name="collection"),
    path("collections/<uuid:collection_id>/items/", CollectionItemsView.as_view(), name="items"),
    path("items/<uuid:item_id>/", ItemDetailView.as_view(), name="item"),
    path("saved/", SavedTargetsView.as_view(), name="saved"),
    path("quick-save/", QuickSaveView.as_view(), name="quick-save"),
]
