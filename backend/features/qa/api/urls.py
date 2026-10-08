from django.urls import path

from .views import (
    AcceptAnswerView,
    AnswerDetailView,
    AnswerListCreateView,
    QuestionDetailView,
    QuestionListCreateView,
    RegenerateAIAnswerView,
    RephraseView,
    SimilarQuestionsView,
    TranscribeView,
    VoteAnswerView,
)

app_name = "qa"

urlpatterns = [
    path("questions/", QuestionListCreateView.as_view(), name="questions"),
    path("questions/<uuid:question_id>/", QuestionDetailView.as_view(), name="question-detail"),
    path(
        "questions/<uuid:question_id>/ai-answer/",
        RegenerateAIAnswerView.as_view(),
        name="question-ai-answer",
    ),
    path("questions/<uuid:question_id>/answers/", AnswerListCreateView.as_view(), name="answers"),
    path("answers/<uuid:answer_id>/", AnswerDetailView.as_view(), name="answer-detail"),
    path("answers/<uuid:answer_id>/accept/", AcceptAnswerView.as_view(), name="answer-accept"),
    path("answers/<uuid:answer_id>/vote/", VoteAnswerView.as_view(), name="answer-vote"),
    path("rephrase/", RephraseView.as_view(), name="rephrase"),
    path("transcribe/", TranscribeView.as_view(), name="transcribe"),
    path("similar/", SimilarQuestionsView.as_view(), name="similar"),
]
