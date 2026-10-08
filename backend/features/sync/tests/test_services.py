import uuid

import pytest

from features.feed import selectors as feed_selectors
from features.qa import selectors as qa_selectors
from features.sync import selectors, services
from features.sync.models import SyncRejection

pytestmark = pytest.mark.django_db(transaction=True)


def _op(op, table, record_id, data=None, op_id=1):
    return {"op_id": op_id, "op": op, "type": table, "id": str(record_id), "data": data or {}}


def test_offline_queue_is_replayed_in_order(user, other_user):
    post_id, question_id, answer_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    result = services.apply_operations(
        user=user,
        operations=[
            _op("PUT", "posts", post_id, {"kind": "text", "body": "Écrit dans le bus"}),
            _op("PATCH", "posts", post_id, {"body": "Écrit dans le bus, corrigé"}),
            _op(
                "PUT",
                "questions",
                question_id,
                {"title": "Question posée hors ligne ?", "body": "…"},
            ),
            _op(
                "PUT",
                "answers",
                answer_id,
                {"question_id": str(question_id), "body": "Auto-réponse"},
            ),
            _op("PATCH", "profiles", user.id, {"bio": "Mise à jour hors ligne"}),
        ],
    )
    assert result == {"applied": 5, "rejected": []}
    assert feed_selectors.get_post(post_id=post_id).body == "Écrit dans le bus, corrigé"
    assert qa_selectors.get_question(question_id=question_id).answer_count == 1
    assert qa_selectors.get_answer(answer_id=answer_id) is not None


def test_replaying_a_batch_after_network_cut_is_harmless(user):
    post_id = uuid.uuid4()
    batch = [
        _op("PUT", "posts", post_id, {"kind": "text", "body": "Un seul post"}),
        _op("DELETE", "posts", post_id),
    ]
    services.apply_operations(user=user, operations=batch)
    result = services.apply_operations(user=user, operations=batch)  # renvoi du même lot
    # La recréation est ignorée (même UUID) et la suppression déjà faite n'est pas une erreur.
    assert result == {"applied": 2, "rejected": []}
    assert feed_selectors.get_post(post_id=post_id) is None


def test_business_errors_are_rejected_without_blocking_the_queue(user, other_user):
    foreign_profile = other_user.id
    good_snippet = uuid.uuid4()
    result = services.apply_operations(
        user=user,
        operations=[
            _op(
                "PUT",
                "snippets",
                uuid.uuid4(),
                {"title": "Fuite", "language": "py", "content": 'api_key = "abcdefghijklmnop"'},
            ),
            _op("PATCH", "profiles", foreign_profile, {"bio": "piraté"}),
            _op("PUT", "unknown_table", uuid.uuid4(), {}),
            _op(
                "PUT",
                "snippets",
                good_snippet,
                {"title": "Ok", "language": "py", "content": "x = 1"},
            ),
        ],
    )
    assert result["applied"] == 1
    assert [r["code"] for r in result["rejected"]] == [
        "secret_detected",
        "permission_denied",
        "invalid",
    ]
    assert selectors.list_pending_rejections(user=user).count() == 3

    services.acknowledge_rejections(user=user, ids=[r["id"] for r in result["rejected"]])
    assert selectors.list_pending_rejections(user=user).count() == 0
    assert SyncRejection.objects.count() == 3
