from django.urls import path

from .views import HubDetailView, HubJoinView, HubListCreateView

app_name = "hubs"

# GET /api/hubs/<slug>/feed/ est servi par features.feed (le fil appartient au fil),
# routé dans config/urls.py avant cet include.
urlpatterns = [
    path("", HubListCreateView.as_view(), name="list-create"),
    path("<slug:slug>/", HubDetailView.as_view(), name="detail"),
    path("<slug:slug>/join/", HubJoinView.as_view(), name="join"),
]
