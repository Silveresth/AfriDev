"""Vues techniques transverses (aucune logique métier)."""

from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import jobs

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


class JobStatusView(APIView):
    @extend_schema(responses=JobSerializer)
    def get(self, request, job_id):
        job = jobs.get_job(job_id, owner_id=request.user.id)
        if job is None:
            raise NotFound("Tâche introuvable ou expirée.")
        return Response(job)
