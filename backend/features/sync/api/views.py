"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import selectors, services, tokens
from .serializers import (
    AcknowledgeInputSerializer,
    PowerSyncTokenSerializer,
    SyncRejectionSerializer,
    UploadInputSerializer,
    UploadOutputSerializer,
)


class PowerSyncTokenView(APIView):
    """Jeton court que le client présente au service PowerSync (fetchCredentials)."""

    @extend_schema(responses=PowerSyncTokenSerializer)
    def get(self, request):
        token, expires_at = tokens.issue_token(request.user)
        return Response({"token": token, "expires_at": expires_at})


class JWKSView(APIView):
    """Clé publique lue par le service PowerSync pour vérifier les jetons."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        response = Response(tokens.jwks())
        response["Cache-Control"] = "public, max-age=3600"
        return response


class UploadView(APIView):
    """File des écritures faites hors ligne, envoyée au retour du réseau (uploadData)."""

    @extend_schema(request=UploadInputSerializer, responses=UploadOutputSerializer)
    def post(self, request):
        data = UploadInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        result = services.apply_operations(
            user=request.user, operations=data.validated_data["operations"]
        )
        return Response(result)


class RejectionListView(APIView):
    @extend_schema(responses=SyncRejectionSerializer(many=True))
    def get(self, request):
        rejections = selectors.list_pending_rejections(user=request.user)[:100]
        return Response(SyncRejectionSerializer(rejections, many=True).data)


class RejectionAcknowledgeView(APIView):
    @extend_schema(request=AcknowledgeInputSerializer, responses={204: None})
    def post(self, request):
        data = AcknowledgeInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.acknowledge_rejections(user=request.user, ids=data.validated_data["ids"])
        return Response(status=204)
