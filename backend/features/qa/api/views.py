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
from core.serializers import AcceptedJobSerializer
from core.throttling import AIQuotaThrottle
from features.hubs import selectors as hub_selectors
from features.knowledge import selectors as knowledge_selectors

from .. import selectors, services
from .serializers import (
    AnswerInputSerializer,
    AnswerOutputSerializer,
    AnswerVoteInputSerializer,
    QuestionInputSerializer,
    QuestionOutputSerializer,
    QuestionUpdateSerializer,
    RephraseInputSerializer,
    SimilarQuestionSerializer,
    TranscribeInputSerializer,
    present_answers,
    present_questions,
)


def _question(question_id):
    question = selectors.get_question(question_id=question_id)
    if question is None:
        raise NotFound("Question introuvable.")
    return question


def _answer(answer_id):
    answer = selectors.get_answer(answer_id=answer_id)
    if answer is None:
        raise NotFound("Réponse introuvable.")
    return answer


class QuestionListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("tag", str, required=False),
            OpenApiParameter("author", str, required=False),
            OpenApiParameter("resolved", bool, required=False),
            OpenApiParameter("q", str, required=False),
            OpenApiParameter("hub", str, required=False, description="Slug ou UUID du hub"),
        ],
        responses=paginated(QuestionOutputSerializer),
        operation_id="qa_questions_list",
    )
    def get(self, request):
        params = request.query_params
        resolved = params.get("resolved")
        hub = params.get("hub")
        hub_id = hub_selectors.resolve_hub_id(value=hub) if hub else None
        questions = selectors.list_questions(
            tag=params.get("tag"),
            author_id=params.get("author"),
            resolved=None if resolved is None else resolved.lower() in ("1", "true"),
            query=params.get("q"),
            hub_id=hub_id,
        )
        if hub and hub_id is None:
            questions = questions.none()
        paginator = CursorPagination()
        page = paginator.paginate_queryset(questions, request)
        return paginator.get_paginated_response(present_questions(page))

    @extend_schema(request=QuestionInputSerializer, responses={201: QuestionOutputSerializer})
    def post(self, request):
        data = QuestionInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        question = services.create_question(
            author=request.user, question_id=values.pop("id", None), **values
        )
        return Response(present_questions([question])[0], status=status.HTTP_201_CREATED)


class QuestionDetailView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=QuestionOutputSerializer)
    def get(self, request, question_id):
        return Response(present_questions([_question(question_id)])[0])

    @extend_schema(request=QuestionUpdateSerializer, responses=QuestionOutputSerializer)
    def patch(self, request, question_id):
        data = QuestionUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        question = services.update_question(
            question=_question(question_id), user=request.user, **data.validated_data
        )
        return Response(present_questions([question])[0])

    @extend_schema(responses={204: None})
    def delete(self, request, question_id):
        services.delete_question(question=_question(question_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RegenerateAIAnswerView(APIView):
    throttle_classes = [AIQuotaThrottle]

    @extend_schema(request=None, responses={202: QuestionOutputSerializer})
    def post(self, request, question_id):
        question = services.request_ai_answer(question=_question(question_id), user=request.user)
        return Response(present_questions([question])[0], status=status.HTTP_202_ACCEPTED)


class AnswerListCreateView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=AnswerOutputSerializer(many=True))
    def get(self, request, question_id):
        _question(question_id)
        return Response(present_answers(selectors.list_answers(question_id=question_id)))

    @extend_schema(request=AnswerInputSerializer, responses={201: AnswerOutputSerializer})
    def post(self, request, question_id):
        data = AnswerInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        answer = services.create_answer(
            author=request.user,
            question=_question(question_id),
            body=data.validated_data["body"],
            answer_id=data.validated_data.get("id"),
        )
        return Response(present_answers([answer])[0], status=status.HTTP_201_CREATED)


class AnswerDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, answer_id):
        services.delete_answer(answer=_answer(answer_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptAnswerView(APIView):
    @extend_schema(request=None, responses=AnswerOutputSerializer)
    def post(self, request, answer_id):
        answer = services.accept_answer(answer=_answer(answer_id), user=request.user)
        return Response(present_answers([answer])[0])


class VoteAnswerView(APIView):
    @extend_schema(request=AnswerVoteInputSerializer, responses=AnswerOutputSerializer)
    def post(self, request, answer_id):
        data = AnswerVoteInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        answer = services.vote_answer(
            answer=_answer(answer_id), user=request.user, value=data.validated_data["value"]
        )
        return Response(present_answers([answer])[0])


class RephraseView(APIView):
    throttle_classes = [AIQuotaThrottle]

    @extend_schema(request=RephraseInputSerializer, responses={202: AcceptedJobSerializer})
    def post(self, request):
        data = RephraseInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        job_id = services.request_rephrase(user=request.user, **data.validated_data)
        return Response({"job_id": job_id}, status=status.HTTP_202_ACCEPTED)


class TranscribeView(APIView):
    throttle_classes = [AIQuotaThrottle]

    @extend_schema(request=TranscribeInputSerializer, responses={202: AcceptedJobSerializer})
    def post(self, request):
        data = TranscribeInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        job_id = services.request_transcription(
            user=request.user,
            media_id=data.validated_data["media_id"],
            language=data.validated_data.get("language"),
        )
        return Response({"job_id": job_id}, status=status.HTTP_202_ACCEPTED)


class SimilarQuestionsView(APIView):
    """Doublons probables, affichés pendant la rédaction (questions déjà résolues)."""

    permission_classes = [AllowAny]

    @extend_schema(
        parameters=[OpenApiParameter("q", str, required=True)],
        responses=SimilarQuestionSerializer(many=True),
    )
    def get(self, request):
        hits = knowledge_selectors.semantic_search(
            query=request.query_params.get("q", "")[:1000],
            limit=5,
            source_types=["question"],
            min_score=0.5,
        )
        return Response([hit.as_dict() for hit in hits])
