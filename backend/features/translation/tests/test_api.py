import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_translate_then_cached_200(auth_client, fake_llm):
    payload = {"text": "Bonjour", "target_language": "en"}
    first = auth_client.post("/api/translation/", payload, format="json")
    assert first.status_code == 202  # en file d'attente (puis exécuté par le worker)
    assert auth_client.get(f"/api/translation/{first.data['id']}/").data["status"] == "ready"

    second = auth_client.post("/api/translation/", payload, format="json")
    assert second.status_code == 200 and second.data["id"] == first.data["id"]


def test_translate_to_an_african_language_names_it_for_the_model(auth_client, fake_llm):
    payload = {"text": "Bonjour", "target_language": "wo", "mode": "simplify"}
    response = auth_client.post("/api/translation/", payload, format="json")
    assert response.status_code == 202
    assert auth_client.get(f"/api/translation/{response.data['id']}/").data["status"] == "ready"
    assert "Langue cible : Wolof (Sénégal)" in fake_llm.calls[-1]["prompt"]


def test_unknown_language_is_rejected(auth_client):
    response = auth_client.post(
        "/api/translation/", {"text": "Bonjour", "target_language": "xx"}, format="json"
    )
    assert response.status_code == 400
