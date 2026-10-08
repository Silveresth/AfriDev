import pytest

from features.translation import services
from features.translation.models import Translation

pytestmark = pytest.mark.django_db(transaction=True)


def test_translation_is_cached_by_content(user, fake_llm):
    fake_llm.when("Langue cible : English", "Use cursor pagination.")
    first = services.request_translation(
        user=user,
        text="Utilisez la pagination par curseur.",
        target_language="en",
        mode="translate",
    )
    first.refresh_from_db()
    assert first.status == Translation.Status.READY
    assert first.result == "Use cursor pagination."

    calls = len(fake_llm.calls)
    second = services.request_translation(
        user=user,
        text="  Utilisez la pagination par curseur. ",
        target_language="en",
        mode="translate",
    )
    assert second.id == first.id and len(fake_llm.calls) == calls


def test_failure_can_be_retried(user, fake_llm, monkeypatch):
    def broken(**kwargs):
        from integrations.llm import LLMError

        raise LLMError("quota")

    monkeypatch.setattr("integrations.llm.client._create", broken)
    failed = services.request_translation(
        user=user, text="Bonjour", target_language="en", mode="simplify"
    )
    failed.refresh_from_db()
    assert failed.status == Translation.Status.FAILED

    monkeypatch.setattr("integrations.llm.client._create", fake_llm)
    retried = services.request_translation(
        user=user, text="Bonjour", target_language="en", mode="simplify"
    )
    retried.refresh_from_db()
    assert retried.id == failed.id and retried.status == Translation.Status.READY
