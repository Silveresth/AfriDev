"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import selectors, services
from .serializers import MediaOutputSerializer, MediaUploadSerializer


class MediaUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(request=MediaUploadSerializer, responses={201: MediaOutputSerializer})
    def post(self, request):
        data = MediaUploadSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        asset = services.upload_media(
            owner=request.user,
            kind=data.validated_data["kind"],
            uploaded_file=data.validated_data["file"],
        )
        return Response(selectors.describe(asset), status=status.HTTP_201_CREATED)


class MediaDetailView(APIView):
    @extend_schema(responses=MediaOutputSerializer)
    def get(self, request, asset_id):
        asset = selectors.get_asset(asset_id=asset_id)
        if asset is None:
            raise NotFound("Média introuvable.")
        return Response(selectors.describe(asset))

    @extend_schema(responses={204: None})
    def delete(self, request, asset_id):
        asset = selectors.get_owned_asset(asset_id=asset_id, owner_id=request.user.id)
        if asset is None:
            raise NotFound("Média introuvable.")
        services.delete_media(asset=asset)
        return Response(status=status.HTTP_204_NO_CONTENT)
