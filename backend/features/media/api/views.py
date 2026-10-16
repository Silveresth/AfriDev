"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from django.conf import settings
from django.urls import reverse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations import cloudinary, storage

from .. import selectors, services
from .serializers import (
    MediaOutputSerializer,
    MediaUploadSerializer,
    PresignUploadInputSerializer,
    PresignUploadOutputSerializer,
)


class MediaUploadView(APIView):
    """Envoi multipart historique : préférer presign-upload (le fichier ne passe pas par l'API)."""

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


class PresignUploadView(APIView):
    """Étape 1 : réserve le média et délivre l'autorisation d'envoi direct vers Cloudinary."""

    @extend_schema(
        request=PresignUploadInputSerializer, responses={201: PresignUploadOutputSerializer}
    )
    def post(self, request):
        data = PresignUploadInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        asset, upload = services.start_upload(owner=request.user, **data.validated_data)
        if upload is None:  # dev sans Cloudinary : l'API locale joue le rôle du stockage
            url = reverse("media:local-upload", kwargs={"asset_id": asset.id})
            upload = storage.PresignedUpload(
                method="PUT",
                url=request.build_absolute_uri(f"{url}?token={services.local_upload_token(asset)}"),
                headers={"Content-Type": asset.mime_type},
            )
        payload = {
            "asset_id": asset.id,
            "upload": {
                "method": upload.method,
                "url": upload.url,
                "headers": upload.headers,
                "fields": upload.fields,
                "file_field": upload.file_field,
            },
            "expires_in": settings.MEDIA_PRESIGN_EXPIRES,
        }
        return Response(payload, status=status.HTTP_201_CREATED)


class CompleteUploadView(APIView):
    """Étape 3 : le client confirme l'envoi ; l'API vérifie l'objet puis lance le traitement."""

    @extend_schema(request=None, responses=MediaOutputSerializer)
    def post(self, request, asset_id):
        asset = selectors.get_owned_asset(
            asset_id=asset_id, owner_id=request.user.id, include_uploading=True
        )
        if asset is None:
            raise NotFound("Média introuvable.")
        asset = services.complete_upload(asset=asset)
        return Response(selectors.describe(asset))


class LocalUploadView(APIView):
    """Développement sans Cloudinary : reçoit le fichier que le client y enverrait."""

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        exclude=True,
        parameters=[OpenApiParameter("token", str, OpenApiParameter.QUERY)],
    )
    def put(self, request, asset_id):
        if cloudinary.is_configured():
            raise NotFound()
        if services.asset_id_from_local_token(request.query_params.get("token", "")) != str(
            asset_id
        ):
            raise PermissionDenied("Lien d'envoi invalide ou expiré.")
        asset = selectors.get_asset(asset_id=asset_id)
        if asset is None:
            raise NotFound("Média introuvable.")
        # Lecture en flux du corps brut (jamais chargé entier en mémoire).
        services.receive_local_upload(asset=asset, stream=request._request)
        return Response(status=status.HTTP_200_OK)


class MediaDetailView(APIView):
    @extend_schema(responses=MediaOutputSerializer)
    def get(self, request, asset_id):
        asset = selectors.get_asset(asset_id=asset_id)
        if asset is None:
            raise NotFound("Média introuvable.")
        return Response(selectors.describe(asset))

    @extend_schema(responses={204: None})
    def delete(self, request, asset_id):
        asset = selectors.get_owned_asset(
            asset_id=asset_id, owner_id=request.user.id, include_uploading=True
        )
        if asset is None:
            raise NotFound("Média introuvable.")
        services.delete_media(asset=asset)
        return Response(status=status.HTTP_204_NO_CONTENT)
