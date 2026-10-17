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
    TargetCommentInputSerializer,
    TargetCommentOutputSerializer,
    present_comments,
    present_target_comments,
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


TARGET_TYPES = {"project", "job"}


class TargetCommentListCreateView(APIView):
    """Commentaires sous un projet ou une offre d'emploi (target_type : project | job)."""

    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        operation_id="discussions_target_comments_list",
        parameters=CURSOR_PARAMETERS,
        responses=paginated(TargetCommentOutputSerializer),
    )
    def get(self, request, target_type, target_id):
        if target_type not in TARGET_TYPES:
            raise NotFound("Type de contenu inconnu.")
        paginator = OldestFirstPagination()
        page = paginator.paginate_queryset(
            selectors.list_target_comments(target_type=target_type, target_id=target_id), request
        )
        return paginator.get_paginated_response(present_target_comments(page))

    @extend_schema(
        operation_id="discussions_target_comments_create",
        request=TargetCommentInputSerializer,
        responses={201: TargetCommentOutputSerializer},
    )
    def post(self, request, target_type, target_id):
        if target_type not in TARGET_TYPES:
            raise NotFound("Type de contenu inconnu.")
        data = TargetCommentInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        comment = services.create_target_comment(
            author=request.user,
            target_type=target_type,
            target_id=target_id,
            body=data.validated_data["body"],
            parent_id=data.validated_data.get("parent_id"),
        )
        return Response(present_target_comments([comment])[0], status=status.HTTP_201_CREATED)


class TargetCommentDetailView(APIView):
    @extend_schema(operation_id="discussions_target_comments_delete", responses={204: None})
    def delete(self, request, comment_id):
        comment = selectors.get_target_comment(comment_id=comment_id)
        if comment is None:
            raise NotFound("Commentaire introuvable.")
        services.delete_target_comment(comment=comment, user=request.user)
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
