from django.urls import path

from .views import GuideDetailView, GuideListCreateView

app_name = "onboarding_agent"

urlpatterns = [
    path("guides/", GuideListCreateView.as_view(), name="guides"),
    path("guides/<uuid:guide_id>/", GuideDetailView.as_view(), name="guide-detail"),
]
