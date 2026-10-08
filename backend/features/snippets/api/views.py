"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated
from features.hubs import selectors as hub_selectors
from features.profiles import selectors as profile_selectors

from .. import selectors, services
from .serializers import (
    PublicSnippetSerializer,
    ScanInputSerializer,
    SecretFindingSerializer,
    SnippetInputSerializer,
    SnippetOutputSerializer,
    SnippetUpdateSerializer,
    SnippetVersionSerializer,
)


def _owned(request, snippet_id):
    snippet = selectors.get_owned_snippet(snippet_id=snippet_id, owner=request.user)
    if snippet is None:
        raise NotFound("Snippet introuvable.")
    return snippet


def _present_public(snippets) -> list[dict]:
    snippets = list(snippets)
    authors = profile_selectors.author_cards(user_ids={s.owner_id for s in snippets})
    hubs = hub_selectors.hub_cards(hub_ids={s.hub_id for s in snippets})
    return [
        {
            "id": s.id,
            "title": s.title,
            "language": s.language,
            "content": s.content,
            "tags": s.tags,
            "hub": hubs.get(s.hub_id),
            "published_at": s.published_at,
            "author": authors.get(s.owner_id),
        }
        for s in snippets
    ]


class SnippetListCreateView(APIView):
    @extend_schema(
        parameters=CURSOR_PARAMETERS,
        responses=paginated(SnippetOutputSerializer),
        operation_id="snippets_list",
    )
    def get(self, request):
        paginator = CursorPagination()
        page = paginator.paginate_queryset(selectors.list_snippets(owner=request.user), request)
        return paginator.get_paginated_response(SnippetOutputSerializer(page, many=True).data)

    @extend_schema(request=SnippetInputSerializer, responses={201: SnippetOutputSerializer})
    def post(self, request):
        data = SnippetInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        snippet = services.create_snippet(
            owner=request.user, snippet_id=values.pop("id", None), **values
        )
        return Response(SnippetOutputSerializer(snippet).data, status=status.HTTP_201_CREATED)


class SnippetDetailView(APIView):
    @extend_schema(responses=SnippetOutputSerializer)
    def get(self, request, snippet_id):
        return Response(SnippetOutputSerializer(_owned(request, snippet_id)).data)

    @extend_schema(request=SnippetUpdateSerializer, responses=SnippetOutputSerializer)
    def patch(self, request, snippet_id):
        data = SnippetUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        snippet = services.update_snippet(
            snippet=_owned(request, snippet_id), user=request.user, **data.validated_data
        )
        return Response(SnippetOutputSerializer(snippet).data)

    @extend_schema(responses={204: None})
    def delete(self, request, snippet_id):
        services.delete_snippet(snippet=_owned(request, snippet_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SnippetPublishView(APIView):
    @extend_schema(request=None, responses=SnippetOutputSerializer)
    def post(self, request, snippet_id):
        snippet = services.publish_snippet(snippet=_owned(request, snippet_id))
        return Response(SnippetOutputSerializer(snippet).data)


class SnippetUnpublishView(APIView):
    @extend_schema(request=None, responses=SnippetOutputSerializer)
    def post(self, request, snippet_id):
        snippet = services.unpublish_snippet(snippet=_owned(request, snippet_id))
        return Response(SnippetOutputSerializer(snippet).data)


class SnippetVersionsView(APIView):
    @extend_schema(responses=SnippetVersionSerializer(many=True))
    def get(self, request, snippet_id):
        snippet = _owned(request, snippet_id)
        return Response(SnippetVersionSerializer(snippet.versions.all(), many=True).data)


class PublicSnippetListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("language", str, required=False),
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("author", str, required=False, description="UUID de l'auteur"),
            OpenApiParameter("hub", str, required=False, description="Slug ou UUID du hub"),
        ],
        responses=paginated(PublicSnippetSerializer),
        operation_id="snippets_public_list",
    )
    def get(self, request):
        hub = request.query_params.get("hub")
        hub_id = hub_selectors.resolve_hub_id(value=hub) if hub else None
        snippets = selectors.list_public_snippets(
            language=request.query_params.get("language"),
            query=request.query_params.get("q"),
            owner_id=request.query_params.get("author"),
            hub_id=hub_id,
        )
        if hub and hub_id is None:
            snippets = snippets.none()
        paginator = CursorPagination()
        page = paginator.paginate_queryset(snippets, request)
        return paginator.get_paginated_response(_present_public(page))


class PublicSnippetDetailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=PublicSnippetSerializer)
    def get(self, request, snippet_id):
        snippet = selectors.get_public_snippet(snippet_id=snippet_id)
        if snippet is None:
            raise NotFound("Snippet introuvable.")
        return Response(_present_public([snippet])[0])


class SecretScanView(APIView):
    @extend_schema(request=ScanInputSerializer, responses=SecretFindingSerializer(many=True))
    def post(self, request):
        data = ScanInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        findings = selectors.find_secrets(data.validated_data["content"])
        return Response([finding.__dict__ for finding in findings])
