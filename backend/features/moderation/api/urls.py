from django.urls import path

from .views import ReportListCreateView, ResolveReportView

app_name = "moderation"

urlpatterns = [
    path("reports/", ReportListCreateView.as_view(), name="reports"),
    path("reports/<uuid:report_id>/resolve/", ResolveReportView.as_view(), name="resolve"),
]
