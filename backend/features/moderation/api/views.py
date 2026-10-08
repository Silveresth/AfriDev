"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from ..models import Report
from .serializers import (
    ModerationReportSerializer,
    ReportInputSerializer,
    ReportOutputSerializer,
    ResolveInputSerializer,
)


def _staff_view(reports: list[Report]) -> list:
    context = {"queue": selectors.queue_context(reports=reports)}
    return ModerationReportSerializer(reports, many=True, context=context).data


class ReportListCreateView(APIView):
    def get_permissions(self):
        # Tout membre peut signaler ; seuls les modérateurs (staff) voient la file.
        return [IsAdminUser()] if self.request.method == "GET" else [IsAuthenticated()]

    @extend_schema(
        operation_id="moderation_reports_list",
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("status", str, required=False, enum=Report.Status.values),
            OpenApiParameter("target_type", str, required=False, enum=Report.TargetType.values),
            OpenApiParameter("source", str, required=False, enum=["ai", "member"]),
        ],
        responses=paginated(ModerationReportSerializer),
    )
    def get(self, request):
        paginator = CursorPagination()
        page = paginator.paginate_queryset(
            selectors.list_reports(
                status=request.query_params.get("status") or None,
                target_type=request.query_params.get("target_type") or None,
                source=request.query_params.get("source") or None,
            ),
            request,
        )
        return paginator.get_paginated_response(_staff_view(list(page)))

    @extend_schema(request=ReportInputSerializer, responses={201: ReportOutputSerializer})
    def post(self, request):
        data = ReportInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        report = services.report_content(reporter=request.user, **data.validated_data)
        return Response(ReportOutputSerializer(report).data, status=status.HTTP_201_CREATED)


class ResolveReportView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(request=ResolveInputSerializer, responses=ModerationReportSerializer)
    def post(self, request, report_id):
        data = ResolveInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        report = selectors.get_report(report_id=report_id)
        if report is None:
            raise NotFound("Signalement introuvable.")
        report = services.resolve_report(
            report=report, moderator=request.user, action=data.validated_data["action"]
        )
        return Response(_staff_view([report])[0])
