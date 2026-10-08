"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import selectors
from .serializers import SearchHitSerializer


class SearchView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=True),
            OpenApiParameter("type", str, required=False, enum=["snippet", "question", "project"]),
            OpenApiParameter(
                "mode",
                str,
                required=False,
                enum=["text", "semantic"],
                description="« text » : tolérant aux fautes ; « semantic » : par le sens.",
            ),
        ],
        responses=SearchHitSerializer(many=True),
    )
    def get(self, request):
        query = request.query_params.get("q", "")[:300]
        source_type = request.query_params.get("type") or None
        if request.query_params.get("mode") == "semantic":
            hits = selectors.semantic_search(
                query=query, limit=10, source_types=[source_type] if source_type else None
            )
        else:
            hits = selectors.fulltext_search(query=query, source_type=source_type)
        return Response([hit.as_dict() for hit in hits])
