import pytest

from core.exceptions import ConflictError, DomainError
from features.accounts import oauth, services
from features.profiles import selectors as profile_selectors
from integrations.github import OAuthIdentity

pytestmark = pytest.mark.django_db(transaction=True)


def test_register_creates_profile_with_same_id(make_user):
    user = make_user("fatou", display_name="Fatou Diop")
    profile = profile_selectors.get_profile_for_user(user_id=user.id)
    assert profile.id == user.id
    assert profile.username == "fatou"
    assert profile.display_name == "Fatou Diop"


def test_register_rejects_duplicates_and_reserved_names(make_user):
    make_user("fatou")
    with pytest.raises(ConflictError):
        services.register_user(
            username="FATOU", email="x@example.com", password="Sup3r-secret-pass"
        )
    with pytest.raises(ConflictError):
        services.register_user(
            username="autre", email="Fatou@Example.com", password="Sup3r-secret-pass"
        )
    with pytest.raises(DomainError):
        services.register_user(username="me", email="me@example.com", password="Sup3r-secret-pass")


def test_login_by_email_or_username(make_user):
    user = make_user("kwame")
    assert (
        services.authenticate_user(identifier="kwame@example.com", password="Sup3r-secret-pass")
        == user
    )
    assert services.authenticate_user(identifier="kwame", password="Sup3r-secret-pass") == user
    with pytest.raises(services.InvalidCredentialsError):
        services.authenticate_user(identifier="kwame", password="mauvais")


def test_oauth_github_creates_account_and_links_existing_email(monkeypatch, make_user):
    identity = OAuthIdentity(
        provider="github",
        uid="42",
        username="ama-codes",
        email="ama@example.com",
        name="Ama",
        avatar_url="https://avatars.example/ama.png",
        access_token="token",
    )
    monkeypatch.setattr(oauth, "fetch_identity", lambda provider, code, redirect_uri=None: identity)

    user, created = services.login_with_oauth(provider="github", code="abc")
    assert created
    profile = profile_selectors.get_profile_for_user(user_id=user.id)
    assert profile.github_username == "ama-codes"
    assert profile.avatar_url == "https://avatars.example/ama.png"

    same, created_again = services.login_with_oauth(provider="github", code="def")
    assert same == user and not created_again
