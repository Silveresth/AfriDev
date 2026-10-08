import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_register_login_refresh_and_me(api_client):
    response = api_client.post(
        "/api/accounts/register/",
        {"username": "sena", "email": "sena@example.com", "password": "Sup3r-secret-pass"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["created"] is True

    login = api_client.post(
        "/api/accounts/login/",
        {"identifier": "sena@example.com", "password": "Sup3r-secret-pass"},
        format="json",
    )
    assert login.status_code == 200
    tokens = login.data["tokens"]

    refresh = api_client.post(
        "/api/accounts/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert refresh.status_code == 200

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    me = api_client.get("/api/accounts/me/")
    assert me.data["username"] == "sena"


def test_errors_use_the_unified_format(api_client):
    response = api_client.post("/api/accounts/register/", {"username": "x"}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid"
    assert "email" in response.data["error"]["details"]

    response = api_client.post(
        "/api/accounts/login/", {"identifier": "nobody", "password": "x"}, format="json"
    )
    assert response.status_code == 401
    assert response.data["error"]["code"] == "invalid_credentials"


def test_otp_request_validates_phone(api_client):
    response = api_client.post("/api/accounts/otp/request/", {"phone_number": "123"}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_phone"

    response = api_client.post(
        "/api/accounts/otp/request/", {"phone_number": "+22890123456"}, format="json"
    )
    assert response.status_code == 202
    assert response.data["expires_in"] == 300


def test_me_requires_authentication(api_client):
    assert api_client.get("/api/accounts/me/").status_code == 401
