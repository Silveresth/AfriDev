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
    assert fake_llm.calls[0]["model"] == "llama-3.1-8b-instant"


def test_complete_json_parses_fenced_json(fake_llm):
    fake_llm.when("json please", '```json\n{"ok": true}\n```')
    assert llm.complete_json(model=llm.SMART_MODEL, system="json please", prompt="x") == {
        "ok": True
    }
    fake_llm.when("broken", "pas du json")
    with pytest.raises(llm.LLMError):
        llm.complete_json(model=llm.FAST_MODEL, system="broken", prompt="x")


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
