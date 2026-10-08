from urllib.parse import parse_qs, urlparse

import pytest

from features.accounts import oauth
from features.accounts.models import SocialAccount
from integrations.github import OAuthIdentity

pytestmark = pytest.mark.django_db

RETURN_TO = "exp://192.168.1.10:8081/--/oauth"


@pytest.fixture
def oauth_settings(settings):
    settings.GITHUB_CLIENT_ID = "gh-id"
    settings.GITHUB_CLIENT_SECRET = "gh-secret"
    settings.GOOGLE_CLIENT_ID = "g-id"
    settings.GOOGLE_CLIENT_SECRET = "g-secret"
    settings.GITLAB_CLIENT_ID = ""
    settings.API_PUBLIC_URL = ""
    return settings


def test_providers_lists_only_configured_ones(api_client, oauth_settings):
    assert api_client.get("/api/accounts/oauth/providers/").data == {
        "providers": ["github", "google"]
    }


def _start(api_client, provider, return_to=RETURN_TO):
    return api_client.get(f"/api/accounts/oauth/{provider}/start/", {"return_to": return_to})


def test_start_redirects_to_google_with_signed_state(api_client, oauth_settings):
    response = _start(api_client, "google")
    assert response.status_code == 302
    url = urlparse(response["Location"])
    query = parse_qs(url.query)
    assert url.netloc == "accounts.google.com"
    assert query["client_id"] == ["g-id"]
    assert query["redirect_uri"] == ["http://testserver/api/accounts/oauth/google/callback/"]
    assert query["state"][0]


def test_start_refuses_web_return_urls(api_client, oauth_settings):
    assert _start(api_client, "github", "https://evil.example/steal").status_code == 400


def test_start_refuses_unconfigured_provider(api_client, oauth_settings):
    assert _start(api_client, "gitlab").status_code == 400


def test_callback_bounces_code_back_to_the_app(api_client, oauth_settings):
    state = parse_qs(urlparse(_start(api_client, "github")["Location"]).query)["state"][0]
    response = api_client.get(
        "/api/accounts/oauth/github/callback/", {"code": "abc", "state": state}
    )
    assert response.status_code == 302
    target = urlparse(response["Location"])
    assert response["Location"].startswith(RETURN_TO + "?")
    assert parse_qs(target.query) == {
        "provider": ["github"],
        "code": ["abc"],
        "redirect_uri": ["http://testserver/api/accounts/oauth/github/callback/"],
    }


def test_callback_reports_provider_errors_to_the_app(api_client, oauth_settings):
    state = parse_qs(urlparse(_start(api_client, "google")["Location"]).query)["state"][0]
    response = api_client.get(
        "/api/accounts/oauth/google/callback/", {"error": "access_denied", "state": state}
    )
    assert parse_qs(urlparse(response["Location"]).query)["error"] == ["access_denied"]


def test_callback_rejects_forged_state(api_client, oauth_settings):
    response = api_client.get(
        "/api/accounts/oauth/github/callback/", {"code": "abc", "state": "forged"}
    )
    assert response.status_code == 400


def test_google_login_creates_account(api_client, oauth_settings, monkeypatch):
    identity = OAuthIdentity(
        provider="google",
        uid="123",
        username="awa.dev",
        email="awa@example.com",
        name="Awa",
        avatar_url="",
        access_token="t",
    )
    monkeypatch.setattr(oauth, "fetch_identity", lambda provider, code, redirect_uri=None: identity)
    response = api_client.post("/api/accounts/oauth/google/", {"code": "abc"}, format="json")
    assert response.status_code == 200
    assert response.data["tokens"]["access"]
    assert SocialAccount.objects.get(provider="google").uid == "123"
