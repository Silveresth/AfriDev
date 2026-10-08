from django.urls import path

from .views import TranslationCreateView, TranslationDetailView

app_name = "translation"

urlpatterns = [
    path("", TranslationCreateView.as_view(), name="create"),
    path("<uuid:translation_id>/", TranslationDetailView.as_view(), name="detail"),
]
