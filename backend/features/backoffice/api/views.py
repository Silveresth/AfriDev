"""Vues minces : valident l'entrée, puis appellent services / selectors. Réservé au staff."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import NotFoundError
from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from .serializers import DashboardSerializer, MemberSerializer, MemberUpdateSerializer


class DashboardView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        operation_id="backoffice_dashboard",
        parameters=[OpenApiParameter("days", int, required=False, enum=list(selectors.PERIODS))],
        responses=DashboardSerializer,
    )
    def get(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except ValueError:
            days = 30
        if days not in selectors.PERIODS:
            days = 30
        return Response(DashboardSerializer(selectors.dashboard(days=days)).data)


class MemberListView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        operation_id="backoffice_members_list",
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("q", str, required=False, description="Pseudo, e-mail ou téléphone."),
            OpenApiParameter("role", str, required=False, enum=["staff", "suspended"]),
        ],
        responses=paginated(MemberSerializer),
    )
    def get(self, request):
        paginator = CursorPagination()
        paginator.ordering = "-date_joined"
        page = paginator.paginate_queryset(
            selectors.list_members(
                query=request.query_params.get("q", "").strip(),
                role=request.query_params.get("role") or None,
            ),
            request,
        )
        users = list(page)
        context = {"cards": selectors.member_cards(users=users)}
        return paginator.get_paginated_response(
            MemberSerializer(users, many=True, context=context).data
        )


class MemberDetailView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        operation_id="backoffice_members_update",
        request=MemberUpdateSerializer,
        responses=MemberSerializer,
        description="Suspendre / réactiver un compte (is_active) ; gérer l'équipe (is_staff, "
        "administrateurs uniquement).",
    )
    def patch(self, request, user_id):
        data = MemberUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = None
        if "is_active" in data.validated_data:
            user = services.set_member_active(
                actor=request.user, user_id=user_id, active=data.validated_data["is_active"]
            )
        if "is_staff" in data.validated_data:
            user = services.set_member_staff(
                actor=request.user, user_id=user_id, staff=data.validated_data["is_staff"]
            )
        if user is None:
            user = selectors.get_member(user_id=user_id)
            if user is None:
                raise NotFoundError("Membre introuvable.")
        context = {"cards": selectors.member_cards(users=[user])}
        return Response(MemberSerializer(user, context=context).data)
