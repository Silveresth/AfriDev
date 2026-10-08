from rest_framework import serializers

from core.serializers import AuthorSerializer, HubSummarySerializer
from features.hubs import selectors as hub_selectors
from features.profiles import selectors as profile_selectors

from ..models import Question


class QuestionInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=10000)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)
    audio_media_id = serializers.UUIDField(required=False, allow_null=True)
    hub_id = serializers.UUIDField(required=False, allow_null=True, help_text="Hub facultatif.")


class QuestionUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)
    body = serializers.CharField(max_length=10000, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), required=False)


class AiSourceSerializer(serializers.Serializer):
    source_type = serializers.CharField()
    source_id = serializers.UUIDField()
    title = serializers.CharField()
    url = serializers.CharField()


class QuestionOutputSerializer(serializers.Serializer):
    """Forme lue aussi par la page publique /questions/<id> (rendu serveur)."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    body = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField())
    audio_media_id = serializers.UUIDField(allow_null=True)
    hub = HubSummarySerializer(allow_null=True)
    ai_answer = serializers.CharField(allow_null=True)
    ai_answer_status = serializers.ChoiceField(choices=Question.AiStatus.choices)
    ai_answer_sources = AiSourceSerializer(many=True)
    is_resolved = serializers.BooleanField()
    answer_count = serializers.IntegerField()
    author = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class AnswerInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(required=False, help_text="UUID généré hors ligne par le client.")
    body = serializers.CharField(max_length=10000)


class AnswerOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    question_id = serializers.UUIDField()
    body = serializers.CharField()
    is_accepted = serializers.BooleanField()
    score = serializers.IntegerField()
    author = AuthorSerializer(allow_null=True)
    created_at = serializers.DateTimeField()


class AnswerVoteInputSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=[-1, 0, 1])


class RephraseInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    body = serializers.CharField(max_length=10000)


class SimilarQuestionSerializer(serializers.Serializer):
    source_type = serializers.CharField()
    source_id = serializers.UUIDField()
    title = serializers.CharField()
    url = serializers.CharField()
    excerpt = serializers.CharField()
    score = serializers.FloatField()


class TranscribeInputSerializer(serializers.Serializer):
    media_id = serializers.UUIDField()
    language = serializers.ChoiceField(choices=["fr", "en"], required=False, allow_null=True)


def present_questions(questions) -> list[dict]:
    questions = list(questions)
    authors = profile_selectors.author_cards(user_ids={q.author_id for q in questions})
    hubs = hub_selectors.hub_cards(hub_ids={q.hub_id for q in questions})
    return [
        {
            "id": q.id,
            "title": q.title,
            "body": q.body,
            "tags": q.tags,
            "audio_media_id": q.audio_media_id,
            "hub": hubs.get(q.hub_id),
            "ai_answer": q.ai_answer or None,
            "ai_answer_status": q.ai_answer_status,
            "ai_answer_sources": q.ai_answer_sources,
            "is_resolved": q.is_resolved,
            "answer_count": q.answer_count,
            "author": authors.get(q.author_id),
            "created_at": q.created_at,
            "updated_at": q.updated_at,
        }
        for q in questions
    ]


def present_answers(answers) -> list[dict]:
    answers = list(answers)
    authors = profile_selectors.author_cards(user_ids={a.author_id for a in answers})
    return [
        {
            "id": a.id,
            "question_id": a.question_id,
            "body": a.body,
            "is_accepted": a.is_accepted,
            "score": a.score,
            "author": authors.get(a.author_id),
            "created_at": a.created_at,
        }
        for a in answers
    ]
