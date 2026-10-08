from django.urls import path

from .views import SearchView

app_name = "knowledge"

urlpatterns = [
    path("search/", SearchView.as_view(), name="search"),
]
