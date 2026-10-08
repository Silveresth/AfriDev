"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.permissions import ReadOnlyOrAuthenticated
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from .serializers import (
    CommentInputSerializer,
    CommentOutputSerializer,
    SummaryOutputSerializer,
    present_comments,
)


class OldestFirstPagination(CursorPagination):
    ordering = "created_at"


class CommentListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(parameters=CURSOR_PARAMETERS, responses=paginated(CommentOutputSerializer))
    def get(self, request, post_id):
        paginator = OldestFirstPagination()
        page = paginator.paginate_queryset(selectors.list_comments(post_id=post_id), request)
        return paginator.get_paginated_response(present_comments(page))

    @extend_schema(request=CommentInputSerializer, responses={201: CommentOutputSerializer})
    def post(self, request, post_id):
        data = CommentInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        comment = services.create_comment(
            author=request.user,
            post_id=post_id,
            comment_id=values.pop("id", None),
            **values,
        )
        return Response(present_comments([comment])[0], status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, comment_id):
        comment = selectors.get_comment(comment_id=comment_id)
        if comment is None:
            raise NotFound("Commentaire introuvable.")
        services.delete_comment(comment=comment, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ThreadSummaryView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=SummaryOutputSerializer)
    def get(self, request, post_id):
        summary = selectors.get_summary(post_id=post_id)
        return Response(
            {
                "post_id": post_id,
                "points": summary.points if summary else [],
                "comment_count": summary.comment_count if summary else 0,
                "updated_at": summary.updated_at if summary else None,
            }
        )
