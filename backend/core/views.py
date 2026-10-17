"""Vues techniques transverses (aucune logique métier)."""

import httpx
from django.db import connection
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import jobs, links
from .exceptions import DomainError
from .throttling import LinkPreviewThrottle

JobSerializer = inline_serializer(
    name="Job",
    fields={
        "id": serializers.UUIDField(),
        "status": serializers.ChoiceField(choices=[jobs.PENDING, jobs.DONE, jobs.FAILED]),
        "result": serializers.JSONField(allow_null=True),
        "error": serializers.CharField(allow_null=True),
    },
)


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        responses=inline_serializer(name="Health", fields={"status": serializers.CharField()})
    )
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return Response({"status": "ok"})


LinkPreviewSerializer = inline_serializer(
    name="LinkPreview",
    fields={
        "url": serializers.CharField(),
        "final_url": serializers.CharField(),
        "status": serializers.IntegerField(),
        "title": serializers.CharField(allow_blank=True),
        "description": serializers.CharField(allow_blank=True),
        "image": serializers.CharField(allow_blank=True),
        "site_name": serializers.CharField(allow_blank=True),
        "frameable": serializers.BooleanField(help_text="Affichable dans un cadre (iframe)."),
    },
)


class LinkPreviewView(APIView):
    """Aperçu d'un lien externe pour la visionneuse interne du site."""

    permission_classes = [AllowAny]
    throttle_classes = [LinkPreviewThrottle]

    @extend_schema(
        parameters=[OpenApiParameter("url", str, required=True)],
        responses=LinkPreviewSerializer,
        operation_id="links_preview",
    )
    def get(self, request):
        url = request.query_params.get("url", "")
        try:
            return Response(links.preview(url))
        except links.UnsafeURL as exc:
            raise DomainError(str(exc), code="invalid_link") from exc
        except httpx.HTTPError as exc:
            raise DomainError("Site injoignable.", code="link_unreachable") from exc


class JobStatusView(APIView):
    @extend_schema(responses=JobSerializer)
    def get(self, request, job_id):
        job = jobs.get_job(job_id, owner_id=request.user.id)
        if job is None:
            raise NotFound("Tâche introuvable ou expirée.")
        return Response(job)
