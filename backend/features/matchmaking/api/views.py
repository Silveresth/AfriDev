"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from features.onboarding_agent import selectors as guide_selectors
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors

from .. import selectors, services
from ..models import ProjectApplication
from .serializers import (
    ApplicationAnswerInputSerializer,
    ApplicationSerializer,
    ApplyInputSerializer,
    CandidateRecommendationSerializer,
    ProjectRecommendationSerializer,
    WelcomeSerializer,
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


class WelcomeView(APIView):
    """GET /api/matchmaking/applications/<id>/welcome/ : tout ce qu'il faut pour démarrer."""

    @extend_schema(responses=WelcomeSerializer, operation_id="matchmaking_welcome")
    def get(self, request, application_id):
        application = _application(application_id)
        project = project_selectors.get_project(project_id=application.project_id)
        if project is None:
            raise NotFound("Projet introuvable.")
        is_candidate = application.candidate_id == request.user.id
        is_owner = project.owner_id == request.user.id
        if (
            not (is_candidate or is_owner)
            or application.status != ProjectApplication.Status.ACCEPTED
        ):
            raise NotFound("Candidature introuvable.")

        team_ids = selectors.accepted_member_ids(project_id=project.id)
        cards = profile_selectors.author_cards(user_ids={project.owner_id, *team_ids})
        guide = guide_selectors.latest_project_guide(project_id=project.id)
        return Response(
            WelcomeSerializer(
                {
                    "application_id": application.id,
                    "accepted_at": application.updated_at,
                    "viewer_role": "candidate" if is_candidate else "owner",
                    "project": {**project_summary(project), "language": project.language},
                    "owner": cards.get(project.owner_id),
                    "team": [cards[uid] for uid in team_ids if uid in cards],
                    "guide": {"id": guide.id, "status": guide.status} if guide else None,
                    "issues": selectors.welcome_issues(project_id=project.id),
                }
            ).data
        )


class ApplicationDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, application_id):
        services.withdraw_application(application=_application(application_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
