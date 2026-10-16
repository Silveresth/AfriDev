import pytest

from core.utils import content_hash, normalize_tags, parse_json_list
from integrations import llm
from integrations.embeddings import cosine_similarity, embed
from integrations.sms import normalize_phone


def test_tag_helpers_accept_sqlite_json_text():
    assert parse_json_list('["a", "b"]') == ["a", "b"]
    assert parse_json_list("a, b") == ["a", "b"]
    assert parse_json_list(None) == []
    assert normalize_tags(["#React", "react", "Node.js"]) == ["react", "node.js"]


def test_content_hash_separates_parts():
    assert content_hash("ab", "c") != content_hash("a", "bc")


def test_phone_normalization():
    assert normalize_phone("00228 90-12-34-56") == "+22890123456"
    with pytest.raises(ValueError):
        normalize_phone("90123456")


def test_local_embeddings_are_normalized_and_meaningful():
    django, flutter, query = embed(["migrations django", "animation flutter", "django migrations"])
    assert cosine_similarity(query, django) > cosine_similarity(query, flutter)
    assert len(django) == 1024


def test_llm_responses_are_cached(fake_llm):
    first = llm.complete(model=llm.FAST_MODEL, system="sys", prompt="Bonjour")
    second = llm.complete(model=llm.FAST_MODEL, system="sys", prompt="Bonjour")
    assert len(fake_llm.calls) == 1
    assert second.cached and second.text == first.text
    assert fake_llm.calls[0]["model"] == "openai/gpt-oss-20b"


def test_complete_json_parses_fenced_json(fake_llm):
    fake_llm.when("json please", '```json\n{"ok": true}\n```')
    assert llm.complete_json(model=llm.SMART_MODEL, system="json please", prompt="x") == {
        "ok": True
    }
    fake_llm.when("broken", "pas du json")
    with pytest.raises(llm.LLMError):
        llm.complete_json(model=llm.FAST_MODEL, system="broken", prompt="x")


def _fake_groq(monkeypatch, *, content, finish_reason="stop"):
    """Faux client Groq : enregistre les arguments de chat.completions.create."""
    from types import SimpleNamespace

    sent = {}

    def create(**kwargs):
        sent.update(kwargs)
        message = SimpleNamespace(content=content)
        return SimpleNamespace(
            model=kwargs["model"],
            choices=[SimpleNamespace(message=message, finish_reason=finish_reason)],
            usage=SimpleNamespace(prompt_tokens=5, completion_tokens=3),
        )

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr("integrations.llm.client.groq_client", lambda: client)
    return sent


def test_reasoning_models_get_low_effort_and_extra_budget(monkeypatch, settings):
    sent = _fake_groq(monkeypatch, content='{"tags": []}')
    llm.complete_json(model="openai/gpt-oss-20b", system="JSON", prompt="x", max_tokens=100)
    assert sent["max_completion_tokens"] == 100 + settings.GROQ_REASONING_BUDGET
    assert sent["extra_body"] == {"include_reasoning": False, "reasoning_effort": "low"}

    sent = _fake_groq(monkeypatch, content="ok")
    llm.complete(model="llama-custom", system="s", prompt="p", max_tokens=50)
    assert sent["max_completion_tokens"] == 50 and "extra_body" not in sent


def test_empty_truncated_reasoning_answer_is_an_error(monkeypatch):
    _fake_groq(monkeypatch, content="", finish_reason="length")
    with pytest.raises(llm.LLMError):
        llm.complete(model="openai/gpt-oss-20b", system="s", prompt="p", use_cache=False)


def test_ai_tasks_get_time_limits():
    from types import SimpleNamespace

    from core.celery_annotations import AITaskLimits

    def task(name, soft=None):
        return SimpleNamespace(name=name, soft_time_limit=soft)

    limits = AITaskLimits()
    assert limits.annotate(task("features.qa.tasks.ai_answer_question"))["time_limit"] > 0
    # Limite propre conservée (onboarding : 300 s) ; le transcodage n'est pas de l'IA.
    assert limits.annotate(task("features.onboarding_agent.tasks.ai_build", 300)) is None
    assert limits.annotate(task("features.media.tasks.transcode_media")) is None


def test_missing_groq_key_raises_unavailable():
    llm.groq_client.cache_clear()
    with pytest.raises(llm.LLMUnavailableError):
        llm.complete(model=llm.FAST_MODEL, system="s", prompt="p", use_cache=False)


@pytest.mark.django_db
def test_health_and_unknown_job(api_client, auth_client):
    assert api_client.get("/api/health/").data == {"status": "ok"}
    response = auth_client.get("/api/jobs/00000000-0000-0000-0000-000000000000/")
    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"
