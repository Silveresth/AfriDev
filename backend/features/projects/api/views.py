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

from .. import selectors, services
from .serializers import (
    IssueSerializer,
    ProjectInputSerializer,
    ProjectOutputSerializer,
    ProjectUpdateSerializer,
    present_projects,
)


def _project(project_id):
    project = selectors.get_project(project_id=project_id)
    if project is None:
        raise NotFound("Projet introuvable.")
    return project


class ProjectListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("tag", str, required=False),
            OpenApiParameter("owner", str, required=False),
            OpenApiParameter("recruiting", bool, required=False),
            OpenApiParameter("q", str, required=False),
        ],
        responses=paginated(ProjectOutputSerializer),
        operation_id="projects_list",
    )
    def get(self, request):
        params = request.query_params
        recruiting = params.get("recruiting")
        projects = selectors.list_projects(
            tag=params.get("tag"),
            owner_id=params.get("owner"),
            recruiting=None if recruiting is None else recruiting.lower() in ("1", "true"),
            query=params.get("q"),
        )
        paginator = CursorPagination()
        page = paginator.paginate_queryset(projects, request)
        return paginator.get_paginated_response(present_projects(page))

    @extend_schema(request=ProjectInputSerializer, responses={201: ProjectOutputSerializer})
    def post(self, request):
        data = ProjectInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        project = services.create_project(
            owner=request.user, project_id=values.pop("id", None), **values
        )
        return Response(present_projects([project])[0], status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=ProjectOutputSerializer)
    def get(self, request, project_id):
        return Response(present_projects([_project(project_id)])[0])

    @extend_schema(request=ProjectUpdateSerializer, responses=ProjectOutputSerializer)
    def patch(self, request, project_id):
        data = ProjectUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        project = services.update_project(
            project=_project(project_id), user=request.user, **data.validated_data
        )
        return Response(present_projects([project])[0])

    @extend_schema(responses={204: None})
    def delete(self, request, project_id):
        services.delete_project(project=_project(project_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectSyncView(APIView):
    @extend_schema(request=None, responses={202: ProjectOutputSerializer})
    def post(self, request, project_id):
        project = services.request_repo_sync(project=_project(project_id), user=request.user)
        return Response(present_projects([project])[0], status=status.HTTP_202_ACCEPTED)


class ProjectIssuesView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=IssueSerializer(many=True))
    def get(self, request, project_id):
        _project(project_id)
        issues = selectors.list_open_issues(project_id=project_id)
        return Response(IssueSerializer(issues, many=True).data)


class GoodFirstIssuesView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[*CURSOR_PARAMETERS, OpenApiParameter("tag", str, required=False)],
        responses=paginated(IssueSerializer),
    )
    def get(self, request):
        paginator = CursorPagination()
        page = paginator.paginate_queryset(
            selectors.list_good_first_issues(tag=request.query_params.get("tag")), request
        )
        return paginator.get_paginated_response(IssueSerializer(page, many=True).data)
