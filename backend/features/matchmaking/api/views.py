"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from features.projects import selectors as project_selectors

from .. import selectors, services
from .serializers import (
    ApplicationAnswerInputSerializer,
    ApplicationSerializer,
    ApplyInputSerializer,
    CandidateRecommendationSerializer,
    ProjectRecommendationSerializer,
    candidate_card,
    project_summary,
)


def _owned_project(request, project_id):
    project = project_selectors.get_project(project_id=project_id)
    if project is None:
        raise NotFound("Projet introuvable.")
    if project.owner_id != request.user.id:
        raise PermissionDenied("Réservé au porteur du projet.")
    return project


def _application(application_id):
    application = selectors.get_application(application_id=application_id)
    if application is None:
        raise NotFound("Candidature introuvable.")
    return application


class RecommendedProjectsView(APIView):
    @extend_schema(responses=ProjectRecommendationSerializer(many=True))
    def get(self, request):
        ranked = selectors.recommend_projects(user_id=request.user.id)
        return Response(
            [
                {"project": project_summary(p), "score": m.score, "matched": m.matched}
                for p, m in ranked
            ]
        )


class RecommendedCandidatesView(APIView):
    @extend_schema(responses=CandidateRecommendationSerializer(many=True))
    def get(self, request, project_id):
        ranked = selectors.recommend_candidates(project=_owned_project(request, project_id))
        return Response(
            [
                {"candidate": candidate_card(p), "score": m.score, "matched": m.matched}
                for p, m in ranked
            ]
        )


class ApplyView(APIView):
    @extend_schema(request=ApplyInputSerializer, responses={201: ApplicationSerializer})
    def post(self, request, project_id):
        data = ApplyInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        application = services.apply_to_project(
            candidate=request.user, project_id=project_id, **data.validated_data
        )
        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


class ProjectApplicationsView(APIView):
    @extend_schema(responses=ApplicationSerializer(many=True))
    def get(self, request, project_id):
        _owned_project(request, project_id)
        applications = selectors.list_applications_for_project(project_id=project_id)
        return Response(ApplicationSerializer(applications, many=True).data)


class MyApplicationsView(APIView):
    @extend_schema(responses=ApplicationSerializer(many=True))
    def get(self, request):
        applications = selectors.list_my_applications(user=request.user)
        return Response(ApplicationSerializer(applications, many=True).data)


class AnswerApplicationView(APIView):
    @extend_schema(request=ApplicationAnswerInputSerializer, responses=ApplicationSerializer)
    def post(self, request, application_id):
        data = ApplicationAnswerInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        application = services.answer_application(
            application=_application(application_id),
            user=request.user,
            accept=data.validated_data["accept"],
        )
        return Response(ApplicationSerializer(application).data)


class ApplicationDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, application_id):
        services.withdraw_application(application=_application(application_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
