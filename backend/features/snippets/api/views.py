"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.permissions import ReadOnlyOrAuthenticated
from core.schema import CURSOR_PARAMETERS, paginated
from features.hubs import selectors as hub_selectors
from features.profiles import selectors as profile_selectors

from .. import selectors, services
from .serializers import (
    PublicSnippetSerializer,
    ScanInputSerializer,
    SecretFindingSerializer,
    SnippetCommentInputSerializer,
    SnippetCommentSerializer,
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
    author_roles = hub_selectors.author_hub_roles(
        pairs={(s.hub_id, s.owner_id) for s in snippets if s.hub_id}
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "language": s.language,
            "content": s.content,
            "tags": s.tags,
            "hub": hubs.get(s.hub_id),
            "published_at": s.published_at,
            "comment_count": s.comment_count,
            "author": authors.get(s.owner_id),
            "author_role": author_roles.get((s.hub_id, s.owner_id)),
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
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=PublicSnippetSerializer)
    def get(self, request, snippet_id):
        snippet = selectors.get_public_snippet(snippet_id=snippet_id)
        if snippet is None:
            raise NotFound("Snippet introuvable.")
        return Response(_present_public([snippet])[0])

    @extend_schema(responses={204: None})
    def delete(self, request, snippet_id):
        snippet = selectors.get_public_snippet(snippet_id=snippet_id)
        if snippet is None:
            raise NotFound("Snippet introuvable.")
        services.delete_snippet(snippet=snippet, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SecretScanView(APIView):
    @extend_schema(request=ScanInputSerializer, responses=SecretFindingSerializer(many=True))
    def post(self, request):
        data = ScanInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        findings = selectors.find_secrets(data.validated_data["content"])
        return Response([finding.__dict__ for finding in findings])


class SnippetCommentListCreateView(APIView):
    """GET : liste publique des commentaires d'un snippet.

    POST : ajouter un commentaire (authentification requise).
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return super().get_permissions()

    @extend_schema(
        parameters=CURSOR_PARAMETERS,
        responses=paginated(SnippetCommentSerializer),
        operation_id="snippets_comments_list",
    )
    def get(self, request, snippet_id):
        comments_qs = selectors.list_comments(snippet_id=snippet_id)
        paginator = CursorPagination()
        page = paginator.paginate_queryset(comments_qs, request)
        author_ids = {c.author_id for c in page}
        authors = profile_selectors.author_cards(user_ids=author_ids)
        data = [
            {
                "id": c.id,
                "body": c.body,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
                "parent_id": c.parent_id,
                "author": authors.get(c.author_id),
            }
            for c in page
        ]
        return paginator.get_paginated_response(SnippetCommentSerializer(data, many=True).data)

    @extend_schema(
        request=SnippetCommentInputSerializer,
        responses={201: SnippetCommentSerializer},
        operation_id="snippets_comments_create",
    )
    def post(self, request, snippet_id):
        data = SnippetCommentInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        snippet = selectors.get_public_snippet(snippet_id=snippet_id)
        if snippet is None:
            raise NotFound("Snippet introuvable ou non public.")

        comment = services.add_comment(
            snippet=snippet,
            author=request.user,
            body=data.validated_data["body"],
            parent_id=data.validated_data.get("parent_id"),
        )
        authors = profile_selectors.author_cards(user_ids={comment.author_id})
        return Response(
            SnippetCommentSerializer(
                {
                    "id": comment.id,
                    "body": comment.body,
                    "created_at": comment.created_at,
                    "updated_at": comment.updated_at,
                    "parent_id": comment.parent_id,
                    "author": authors.get(comment.author_id),
                }
            ).data,
            status=status.HTTP_201_CREATED,
        )


class SnippetCommentDeleteView(APIView):
    """Suppression douce d'un commentaire par son auteur ou le modérateur du hub."""

    @extend_schema(responses={204: None}, operation_id="snippets_comments_delete")
    def delete(self, request, snippet_id, comment_id):
        comment = selectors.get_comment(comment_id=comment_id)
        if comment is None or str(comment.snippet_id) != str(snippet_id):
            raise NotFound("Commentaire introuvable.")
        services.delete_comment(comment=comment, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
