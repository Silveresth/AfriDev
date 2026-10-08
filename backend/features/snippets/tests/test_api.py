import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_vault_is_private_and_public_page_is_open(api_client, auth_client, client_for, other_user):
    created = auth_client.post(
        "/api/snippets/",
        {"title": "Hello", "language": "python", "content": "print('hello')"},
        format="json",
    )
    assert created.status_code == 201
    snippet_id = created.data["id"]

    # Privé : ni les autres, ni la page publique ne le voient.
    assert client_for(other_user).get(f"/api/snippets/{snippet_id}/").status_code == 404
    assert api_client.get(f"/api/snippets/public/{snippet_id}/").status_code == 404

    assert auth_client.post(f"/api/snippets/{snippet_id}/publish/").status_code == 200
    public = api_client.get(f"/api/snippets/public/{snippet_id}/")
    assert public.status_code == 200
    assert public.data["author"]["username"] == "amina"


def test_secret_detected_returns_explicit_error(auth_client):
    response = auth_client.post(
        "/api/snippets/",
        {"title": "Clé", "language": "text", "content": "-----BEGIN RSA PRIVATE KEY-----"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "secret_detected"


def test_scan_endpoint(auth_client):
    response = auth_client.post(
        "/api/snippets/scan/",
        {"content": "ok\nkey = 'sk-ant-abcdefghijklmnopqrstuvwxyz'"},
        format="json",
    )
    assert response.data == [
        {"rule_id": "anthropic-api-key", "description": "Clé d'API Anthropic", "line": 2}
    ]
