import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_invalid_repo_is_rejected(auth_client):
    response = auth_client.post(
        "/api/onboarding-agent/guides/", {"repo_url": "https://example.com/x"}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_repo"


def test_list_my_guides_is_empty_at_first(auth_client):
    assert auth_client.get("/api/onboarding-agent/guides/").data == []
