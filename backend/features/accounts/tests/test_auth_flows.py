import re
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail

pytestmark = pytest.mark.django_db


@pytest.fixture
def oauth_settings(settings):
    settings.GITHUB_CLIENT_ID = "gh-id"
    settings.GITHUB_CLIENT_SECRET = "gh-secret"
    settings.GOOGLE_CLIENT_ID = "g-id"
    settings.GOOGLE_CLIENT_SECRET = "g-secret"
    settings.PUBLIC_WEB_URL = "https://afridev.example"
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]
    settings.API_PUBLIC_URL = ""
    return settings


def test_web_oauth_bounces_back_to_the_site_with_nonce(api_client, oauth_settings):
    start = api_client.get(
        "/api/accounts/oauth/google/start/",
        {"return_to": "https://afridev.example/oauth/callback", "nonce": "n-123"},
    )
    assert start.status_code == 302
    state = parse_qs(urlparse(start["Location"]).query)["state"][0]

    callback = api_client.get("/api/accounts/oauth/google/callback/", {"code": "c", "state": state})
    target = urlparse(callback["Location"])
    assert f"{target.scheme}://{target.netloc}{target.path}" == (
        "https://afridev.example/oauth/callback"
    )
    assert parse_qs(target.query)["nonce"] == ["n-123"]
    assert parse_qs(target.query)["code"] == ["c"]


def test_web_oauth_accepts_cors_origins_but_not_other_paths(api_client, oauth_settings):
    ok = api_client.get(
        "/api/accounts/oauth/github/start/",
        {"return_to": "http://localhost:3000/oauth/callback"},
    )
    assert ok.status_code == 302
    bad = api_client.get(
        "/api/accounts/oauth/github/start/",
        {"return_to": "https://afridev.example/steal"},
    )
    assert bad.status_code == 400


def test_username_status(api_client, user):
    assert api_client.get("/api/accounts/username-status/?username=nouveau").data["available"]
    taken = api_client.get("/api/accounts/username-status/?username=AMINA").data
    assert taken["available"] is False
    assert taken["suggestion"] and taken["suggestion"].lower() != "amina"
    invalid = api_client.get("/api/accounts/username-status/?username=a!").data
    assert invalid["available"] is False and invalid["suggestion"] == ""


def test_password_reset_flow(api_client, user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(
            "/api/accounts/password/reset/", {"email": "AMINA@example.com"}, format="json"
        )
    assert response.status_code == 202
    assert len(mail.outbox) == 1
    link = re.search(r"https?://\S+", mail.outbox[0].body).group(0)
    query = parse_qs(urlparse(link).query)

    done = api_client.post(
        "/api/accounts/password/reset/confirm/",
        {"uid": query["uid"][0], "token": query["token"][0], "password": "N0uveau-secret!"},
        format="json",
    )
    assert done.status_code == 200
    assert done.data["tokens"]["access"]
    # Le lien ne sert qu'une fois (le jeton dépend du mot de passe).
    again = api_client.post(
        "/api/accounts/password/reset/confirm/",
        {"uid": query["uid"][0], "token": query["token"][0], "password": "Autre-secret-42"},
        format="json",
    )
    assert again.status_code == 400
    login = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "N0uveau-secret!"},
        format="json",
    )
    assert login.status_code == 200


def test_password_reset_does_not_reveal_unknown_emails(api_client, db):
    response = api_client.post(
        "/api/accounts/password/reset/", {"email": "personne@example.com"}, format="json"
    )
    assert response.status_code == 202
    assert mail.outbox == []
