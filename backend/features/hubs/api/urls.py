from django.urls import path

from .views import (
    HubBanLiftView,
    HubBansView,
    HubDetailView,
    HubJoinView,
    HubListCreateView,
    HubMemberRemoveView,
    HubMembersView,
    HubModeratorsView,
)

app_name = "hubs"

# GET /api/hubs/<slug>/feed/ est servi par features.feed (le fil appartient au fil),
# routé dans config/urls.py avant cet include.
urlpatterns = [
    path("", HubListCreateView.as_view(), name="list-create"),
    path("<slug:slug>/", HubDetailView.as_view(), name="detail"),
    path("<slug:slug>/join/", HubJoinView.as_view(), name="join"),
    path("<slug:slug>/moderators/", HubModeratorsView.as_view(), name="moderators"),
    path("<slug:slug>/members/", HubMembersView.as_view(), name="members"),
    path(
        "<slug:slug>/members/<str:username>/remove/",
        HubMemberRemoveView.as_view(),
        name="member-remove",
    ),
    path("<slug:slug>/bans/", HubBansView.as_view(), name="bans"),
    path("<slug:slug>/bans/<str:username>/lift/", HubBanLiftView.as_view(), name="ban-lift"),
]
