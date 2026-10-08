"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import AIQuotaThrottle

from .. import selectors, services
from ..models import Translation
from .serializers import TranslationInputSerializer, TranslationOutputSerializer


class TranslationCreateView(APIView):
    throttle_classes = [AIQuotaThrottle]

    @extend_schema(
        request=TranslationInputSerializer,
        responses={200: TranslationOutputSerializer, 202: TranslationOutputSerializer},
        description="200 si la traduction est déjà en cache, 202 sinon (interroger GET /<id>/).",
    )
    def post(self, request):
        data = TranslationInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        translation = services.request_translation(user=request.user, **data.validated_data)
        ready = translation.status == Translation.Status.READY
        code = status.HTTP_200_OK if ready else status.HTTP_202_ACCEPTED
        return Response(TranslationOutputSerializer(translation).data, status=code)


class TranslationDetailView(APIView):
    @extend_schema(responses=TranslationOutputSerializer)
    def get(self, request, translation_id):
        translation = selectors.get_translation(translation_id=translation_id)
        if translation is None:
            raise NotFound("Traduction introuvable.")
        return Response(TranslationOutputSerializer(translation).data)
