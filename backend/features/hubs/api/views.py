"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.permissions import ReadOnlyOrAuthenticated
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from .serializers import HubInputSerializer, HubOutputSerializer, HubUpdateSerializer, present_hubs

# Tri de l'exploration : populaires (membres) ou récents.
SORTS = {"popular": "-member_count", "new": "-created_at"}


def _hub(slug):
    hub = selectors.get_hub_by_slug(slug=slug)
    if hub is None:
        raise NotFound("Hub introuvable.")
    return hub


def _one(hub, request):
    return present_hubs([hub], viewer=request.user, detail=True)[0]


class HubListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("country", str, required=False),
            OpenApiParameter("mine", bool, required=False, description="Hubs dont je suis membre"),
            OpenApiParameter("sort", str, required=False, enum=list(SORTS)),
        ],
        responses=paginated(HubOutputSerializer),
        operation_id="hubs_list",
    )
    def get(self, request):
        params = request.query_params
        mine = params.get("mine", "").lower() in ("1", "true")
        hubs = selectors.list_hubs(
            query=params.get("q"),
            country=params.get("country"),
            member_id=request.user.id if mine and request.user.is_authenticated else None,
        )
        if mine and not request.user.is_authenticated:
            hubs = hubs.none()
        paginator = CursorPagination()
        paginator.ordering = SORTS.get(params.get("sort", "popular"), "-member_count")
        page = paginator.paginate_queryset(hubs, request)
        return paginator.get_paginated_response(present_hubs(page, viewer=request.user))

    @extend_schema(request=HubInputSerializer, responses={201: HubOutputSerializer})
    def post(self, request):
        data = HubInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        hub = services.create_hub(creator=request.user, **data.validated_data)
        return Response(_one(hub, request), status=status.HTTP_201_CREATED)


class HubDetailView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=HubOutputSerializer)
    def get(self, request, slug):
        return Response(_one(_hub(slug), request))

    @extend_schema(request=HubUpdateSerializer, responses=HubOutputSerializer)
    def patch(self, request, slug):
        data = HubUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        hub = services.update_hub(hub=_hub(slug), user=request.user, **data.validated_data)
        return Response(_one(hub, request))

    @extend_schema(responses={204: None})
    def delete(self, request, slug):
        services.delete_hub(hub=_hub(slug), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class HubJoinView(APIView):
    """POST : rejoindre (idempotent) ; DELETE : quitter."""

    @extend_schema(request=None, responses=HubOutputSerializer)
    def post(self, request, slug):
        hub = _hub(slug)
        services.join_hub(hub=hub, user=request.user)
        return Response(_one(hub, request))

    @extend_schema(responses=HubOutputSerializer)
    def delete(self, request, slug):
        hub = _hub(slug)
        services.leave_hub(hub=hub, user=request.user)
        return Response(_one(hub, request))
