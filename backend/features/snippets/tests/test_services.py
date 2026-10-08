import pytest

from core.exceptions import PermissionDeniedError
from features.knowledge import selectors as knowledge_selectors
from features.notifications import selectors as notification_selectors
from features.snippets import services
from features.snippets.models import Snippet

pytestmark = pytest.mark.django_db(transaction=True)

CODE = "def pay(amount):\n    return wave.charge(amount)\n"


def test_create_update_keeps_versions(user):
    snippet = services.create_snippet(
        owner=user, title="Paiement Wave", language="Python", content=CODE, tags=["Wave"]
    )
    assert snippet.language == "python" and snippet.tags == ["wave"]
    services.update_snippet(snippet=snippet, user=user, content=CODE + "# v2\n")
    assert list(snippet.versions.values_list("number", flat=True)) == [2, 1]


def test_secret_blocks_creation_and_update(user):
    with pytest.raises(services.SecretDetectedError) as error:
        services.create_snippet(
            owner=user, title="AWS", language="python", content='KEY = "AKIAABCDEFGHIJKLMNOP"'
        )
    assert error.value.details["findings"][0]["rule_id"] == "aws-access-key"

    snippet = services.create_snippet(owner=user, title="Ok", language="python", content=CODE)
    with pytest.raises(services.SecretDetectedError):
        services.update_snippet(
            snippet=snippet, user=user, content="token = 'ghp_" + "a" * 36 + "'"
        )


def test_only_owner_can_edit(user, other_user):
    snippet = services.create_snippet(
        owner=user, title="Mien", language="go", content="package main"
    )
    with pytest.raises(PermissionDeniedError):
        services.update_snippet(snippet=snippet, user=other_user, title="Volé")


def test_publish_indexes_for_rag_and_ai_review_adds_tags(user, fake_llm):
    fake_llm.when("extrait de code", {"risky": False, "reasons": [], "tags": ["python", "wave"]})
    snippet = services.create_snippet(
        owner=user, title="Paiement Wave", language="python", content=CODE
    )

    services.publish_snippet(snippet=snippet)

    snippet.refresh_from_db()
    assert snippet.is_public and snippet.ai_review["risky"] is False
    assert snippet.tags == ["python", "wave"]
    hits = knowledge_selectors.semantic_search(query="paiement wave python", limit=3)
    assert hits and hits[0].source_id == str(snippet.id)


def test_risky_snippet_is_unpublished_and_owner_notified(user, fake_llm):
    fake_llm.when(
        "extrait de code", {"risky": True, "reasons": ["Numéro marchand réel"], "tags": []}
    )
    snippet = services.create_snippet(
        owner=user, title="Marchand", language="js", content="const merchant = 'MERCH-0042';"
    )
    services.publish_snippet(snippet=snippet)

    snippet.refresh_from_db()
    assert snippet.is_public is False
    assert not knowledge_selectors.is_indexed(source_type="snippet", source_id=snippet.id)
    kinds = [n.kind for n in notification_selectors.list_notifications(user=user)]
    assert "snippet_flagged" in kinds


def test_offline_write_creates_then_deletes(user):
    record_id = "6f1d1d1e-1c1a-4c86-9a49-3b8b4f0c9b11"
    services.apply_offline_write(
        user=user,
        op="PUT",
        record_id=record_id,
        data={
            "title": "Hors ligne",
            "language": "dart",
            "content": "void main() {}",
            "tags": '["flutter"]',
        },
    )
    snippet = Snippet.objects.get(id=record_id)
    assert snippet.tags == ["flutter"]
    services.apply_offline_write(user=user, op="DELETE", record_id=record_id, data={})
    snippet.refresh_from_db()
    assert snippet.deleted_at is not None
