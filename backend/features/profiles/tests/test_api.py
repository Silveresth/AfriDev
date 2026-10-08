import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_public_profile_and_qr_code_are_public(api_client, user):
    response = api_client.get("/api/profiles/amina/")
    assert response.status_code == 200
    assert response.data["username"] == "amina"
    assert response.data["id"] == str(user.id)

    qr = api_client.get("/api/profiles/amina/qr.svg")
    assert qr.status_code == 200
    assert qr["Content-Type"] == "image/svg+xml"
    assert b"<svg" in qr.content

    assert api_client.get("/api/profiles/inconnu/").status_code == 404


def test_patch_my_profile(auth_client):
    response = auth_client.patch(
        "/api/profiles/me/", {"stack": ["Python", "py"], "open_to_work": True}, format="json"
    )
    assert response.status_code == 200
    assert response.data["stack"] == ["python", "py"]
    assert response.data["open_to_work"] is True


def test_request_ai_bio_returns_202(auth_client, fake_llm):
    response = auth_client.post("/api/profiles/me/ai-bio/")
    assert response.status_code == 202
    assert auth_client.get("/api/profiles/me/").data["ai_bio_status"] == "ready"


def test_accent_color(auth_client, user):
    updated = auth_client.patch("/api/profiles/me/", {"accent_color": "teal"}, format="json")
    assert updated.status_code == 200 and updated.data["accent_color"] == "teal"
    invalid = auth_client.patch("/api/profiles/me/", {"accent_color": "fuchsia"}, format="json")
    assert invalid.status_code == 400
    reset = auth_client.patch("/api/profiles/me/", {"accent_color": ""}, format="json")
    assert reset.data["accent_color"] == ""
