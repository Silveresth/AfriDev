import pytest

from core import jobs
from core.exceptions import DomainError, PermissionDeniedError
from features.knowledge import selectors as knowledge_selectors
from features.notifications import selectors as notification_selectors
from features.qa import services
from features.qa.models import Question
from features.snippets import services as snippet_services

pytestmark = pytest.mark.django_db(transaction=True)

TITLE = "Comment paginer une API Django REST ?"


def test_question_gets_rag_answer_citing_sources(user, fake_llm):
    # Un snippet public alimente la base de connaissances (via l'event snippet_published).
    snippet = snippet_services.create_snippet(
        owner=user,
        title="Pagination par curseur DRF",
        language="python",
        content="# Paginer une API Django REST\npagination_class = CursorPagination\n",
        is_public=True,
    )
    fake_llm.when("Question :", "Utilisez la pagination par curseur [1].")

    question = services.create_question(author=user, title=TITLE, body="Ma liste est trop longue.")
    question.refresh_from_db()

    assert question.ai_answer_status == Question.AiStatus.READY
    assert question.ai_answer.endswith("[1].")
    assert question.ai_answer_sources[0]["source_id"] == str(snippet.id)
    prompt = next(call["prompt"] for call in fake_llm.calls if "Question :" in call["prompt"])
    assert "Pagination par curseur DRF" in prompt
    kinds = [n.kind for n in notification_selectors.list_notifications(user=user)]
    assert "ai_answer_ready" in kinds


def test_ai_answer_is_disabled_without_provider(user):
    question = services.create_question(author=user, title=TITLE, body="Sans clé Groq.")
    question.refresh_from_db()
    assert question.ai_answer_status == Question.AiStatus.DISABLED


def test_questions_are_protected_by_security_guard(user):
    with pytest.raises(services.SecretDetectedError):
        services.create_question(
            author=user, title=TITLE, body='settings.py : SECRET_KEY = "abcdefghijklmnopqrst"'
        )
    with pytest.raises(DomainError):
        services.create_question(author=user, title="Court", body="x")


def test_accepting_answer_resolves_indexes_and_notifies(user, other_user):
    question = services.create_question(author=user, title=TITLE, body="Détails")
    answer = services.create_answer(author=other_user, question=question, body="CursorPagination !")
    question.refresh_from_db()
    assert question.answer_count == 1

    with pytest.raises(PermissionDeniedError):
        services.accept_answer(answer=answer, user=other_user)
    services.accept_answer(answer=answer, user=user)

    question.refresh_from_db()
    assert question.is_resolved
    assert knowledge_selectors.is_indexed(source_type="question", source_id=question.id)
    kinds = [n.kind for n in notification_selectors.list_notifications(user=other_user)]
    assert "answer_accepted" in kinds
    assert "new_answer" in [n.kind for n in notification_selectors.list_notifications(user=user)]


def test_votes(user, other_user, make_user):
    question = services.create_question(author=user, title=TITLE, body="Détails")
    answer = services.create_answer(author=other_user, question=question, body="Réponse")
    third = make_user("yao")
    assert services.vote_answer(answer=answer, user=user, value=1).score == 1
    assert services.vote_answer(answer=answer, user=third, value=-1).score == 0
    assert services.vote_answer(answer=answer, user=third, value=0).score == 1
    with pytest.raises(DomainError):
        services.vote_answer(answer=answer, user=other_user, value=1)


def test_rephrase_job(user, fake_llm):
    fake_llm.when(
        "reformuler", {"title": "Pagination DRF : liste trop longue", "body": "Contexte…"}
    )
    job_id = services.request_rephrase(user=user, title="aide api", body="ça marche pas")
    job = jobs.get_job(job_id, owner_id=user.id)
    assert job["status"] == "done"
    assert job["result"]["title"] == "Pagination DRF : liste trop longue"
    assert jobs.get_job(job_id, owner_id="quelqu-un-d-autre") is None
