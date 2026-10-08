import uuid

import jwt
import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_powersync_token_is_verifiable_with_jwks(api_client, auth_client, user):
    token = auth_client.get("/api/sync/token/").data["token"]
    jwks = api_client.get("/api/sync/jwks/").data

    key = jwt.PyJWK(jwks["keys"][0])
    assert jwt.get_unverified_header(token)["kid"] == key.key_id
    claims = jwt.decode(token, key.key, algorithms=["RS256"], audience="powersync")
    assert claims["sub"] == str(user.id)


def test_upload_matches_the_powersync_connector_payload(auth_client):
    post_id = str(uuid.uuid4())
    response = auth_client.post(
        "/api/sync/upload/",
        {
            "operations": [
                {
                    "op_id": 1,
                    "op": "PUT",
                    "type": "posts",
                    "id": post_id,
                    "tx_id": 3,
                    "data": {
                        "kind": "text",
                        "body": "Envoyé au retour du réseau",
                        "poll_options": "[]",
                        "media_id": None,
                    },
                },
            ]
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data == {"applied": 1, "rejected": []}
    assert auth_client.get(f"/api/feed/{post_id}/").data["body"] == "Envoyé au retour du réseau"


def test_token_requires_login(api_client):
    assert api_client.get("/api/sync/token/").status_code == 401
