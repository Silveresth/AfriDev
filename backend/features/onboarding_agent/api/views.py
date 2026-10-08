"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import AIQuotaThrottle

from .. import selectors, services
from ..models import OnboardingGuide
from .serializers import GuideRequestSerializer, GuideSerializer


class GuideListCreateView(APIView):
    def get_throttles(self):
        return [AIQuotaThrottle()] if self.request.method == "POST" else super().get_throttles()

    @extend_schema(
        parameters=[OpenApiParameter("project", str, required=False)],
        responses=GuideSerializer(many=True),
    )
    def get(self, request):
        project_id = request.query_params.get("project")
        guides = (
            selectors.list_guides(project_id=project_id)
            if project_id
            else selectors.list_guides(user=request.user)
        )
        return Response(GuideSerializer(guides.order_by("-created_at")[:50], many=True).data)

    @extend_schema(
        request=GuideRequestSerializer,
        responses={200: GuideSerializer, 202: GuideSerializer},
        description="200 si un guide récent existe déjà pour ce dépôt, 202 sinon.",
    )
    def post(self, request):
        data = GuideRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        guide = services.request_guide(user=request.user, **data.validated_data)
        ready = guide.status == OnboardingGuide.Status.READY
        code = status.HTTP_200_OK if ready else status.HTTP_202_ACCEPTED
        return Response(GuideSerializer(guide).data, status=code)


class GuideDetailView(APIView):
    @extend_schema(responses=GuideSerializer)
    def get(self, request, guide_id):
        guide = selectors.get_guide(guide_id=guide_id)
        if guide is None:
            raise NotFound("Guide introuvable.")
        return Response(GuideSerializer(guide).data)
