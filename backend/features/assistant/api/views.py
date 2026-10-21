"""Vues minces : valident l'entrée, puis appellent services. Résultats via /api/jobs/<id>/."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import AIQuotaThrottle

from .. import services
from .serializers import (
    AskInputSerializer,
    ChatRepliesInputSerializer,
    CodeReviewInputSerializer,
    DigestResponseSerializer,
    HubSuggestInputSerializer,
    JobAcceptedSerializer,
    JobMatchInputSerializer,
    TeamInputSerializer,
    TeamInviteInputSerializer,
    VoiceSearchInputSerializer,
)


def _accepted(job_id: str) -> Response:
    return Response({"job_id": job_id}, status=status.HTTP_202_ACCEPTED)


class _AIView(APIView):
    throttle_classes = [AIQuotaThrottle]


class JobMatchView(_AIView):
    @extend_schema(
        operation_id="assistant_job_match",
        request=JobMatchInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="Score de correspondance offre ↔ profil, points forts, écarts et plan "
        "d'apprentissage (result : score, verdict, strengths, gaps, plan).",
    )
    def post(self, request):
        data = JobMatchInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_job_match(user=request.user, **data.validated_data))


class CodeReviewView(_AIView):
    @extend_schema(
        operation_id="assistant_code_review",
        request=CodeReviewInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="Relecture d'un snippet ou d'un code collé (result : summary, score, issues).",
    )
    def post(self, request):
        data = CodeReviewInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_code_review(user=request.user, **data.validated_data))


class ChatRepliesView(_AIView):
    @extend_schema(
        operation_id="assistant_chat_replies",
        request=ChatRepliesInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="Trois réponses rapides suggérées (result : replies).",
    )
    def post(self, request):
        data = ChatRepliesInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_chat_replies(user=request.user, **data.validated_data))


class DigestView(APIView):
    @extend_schema(
        operation_id="assistant_digest",
        responses={200: DigestResponseSerializer, 202: DigestResponseSerializer},
        description="Résumé du jour : 200 s'il est prêt (digest null = rien à signaler), 202 avec "
        "un job_id s'il est en préparation.",
    )
    def get(self, request):
        cached = services.cached_digest(user_id=request.user.id)
        if cached is not None:
            return Response({"digest": cached or None, "job_id": None})
        job_id = services.request_digest(user=request.user)
        return Response({"digest": None, "job_id": job_id}, status=status.HTTP_202_ACCEPTED)


class TeamView(_AIView):
    @extend_schema(
        operation_id="assistant_team",
        request=TeamInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="Membres complémentaires proposés pour un projet (porteur seulement ; "
        "result : candidates, invitation).",
    )
    def post(self, request):
        data = TeamInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_team(user=request.user, **data.validated_data))


class TeamInviteView(APIView):
    @extend_schema(
        operation_id="assistant_team_invite",
        request=TeamInviteInputSerializer,
        responses={204: None},
    )
    def post(self, request):
        data = TeamInviteInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.invite_teammate(user=request.user, **data.validated_data)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileReviewView(_AIView):
    @extend_schema(
        operation_id="assistant_profile_review",
        request=None,
        responses={202: JobAcceptedSerializer},
        description="Analyse du profil et du compte GitHub du membre connecté (result : score, "
        "headline, strengths, improvements[{title, detail, action}], github).",
    )
    def post(self, request):
        return _accepted(services.request_profile_review(user=request.user))


class AskView(_AIView):
    @extend_schema(
        operation_id="assistant_ask",
        request=AskInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="« Demande à AfriDev » : réponse Markdown appuyée sur les contenus de la "
        "plateforme (result : answer, sources[{n, title, url, type}]).",
    )
    def post(self, request):
        data = AskInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_ask(user=request.user, **data.validated_data))


class FirstContributionsView(_AIView):
    @extend_schema(
        operation_id="assistant_first_contributions",
        request=None,
        responses={202: JobAcceptedSerializer},
        description="Issues des projets de la communauté adaptées à une première contribution "
        "(result : picks[{issue_id, number, title, url, labels, labeled, project, level, why, "
        "first_step}]).",
    )
    def post(self, request):
        return _accepted(services.request_first_contributions(user=request.user))


class HubSuggestView(_AIView):
    @extend_schema(
        operation_id="assistant_hub_suggest",
        request=HubSuggestInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="Hubs proposés pour un post en cours d'écriture "
        "(result : hubs[{id, slug, name, icon, is_verified, reason}]).",
    )
    def post(self, request):
        data = HubSuggestInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_hub_suggestions(user=request.user, **data.validated_data))


class VoiceSearchView(_AIView):
    @extend_schema(
        operation_id="assistant_voice_search",
        request=VoiceSearchInputSerializer,
        responses={202: JobAcceptedSerializer},
        description="Recherche dictée : transcription puis requête structurée "
        "(result : text, query, scope, filters).",
    )
    def post(self, request):
        data = VoiceSearchInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return _accepted(services.request_voice_search(user=request.user, **data.validated_data))
