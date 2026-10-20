"""Non-régression des failles corrigées lors de l'audit de sécurité (comptes et connexion)."""

from urllib.parse import parse_qs, urlparse

import pytest
from django.core import signing

from core.exceptions import DomainError
from features.accounts import lockout, oauth, services, web_session
from features.accounts.models import SocialAccount
from integrations.github import OAuthIdentity

pytestmark = pytest.mark.django_db


def _identity(email: str) -> OAuthIdentity:
    return OAuthIdentity(
        provider="google",
        uid="g-42",
        username="victime",
        email=email,
        name="Victime",
        avatar_url="",
        access_token="t",
    )


# ── Force brute ──


def test_login_locks_account_after_repeated_failures(api_client, user):
    for _ in range(lockout.MAX_FAILURES):
        response = api_client.post(
            "/api/accounts/login/", {"identifier": "amina", "password": "faux"}, format="json"
        )
        assert response.status_code == 401
    # Même le bon mot de passe est refusé tant que le verrou dure (attaque répartie sur des IP).
    locked = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
    )
    assert locked.status_code == 429
    # Le verrou suit le compte, quel que soit l'identifiant employé (e-mail ou pseudo).
    by_email = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina@example.com", "password": "Sup3r-secret-pass"},
        format="json",
    )
    assert by_email.status_code == 429


def test_successful_login_resets_the_counter(user):
    for _ in range(lockout.MAX_FAILURES - 1):
        with pytest.raises(services.InvalidCredentialsError):
            services.authenticate_user(identifier="amina", password="faux")
    assert services.authenticate_user(identifier="amina", password="Sup3r-secret-pass") == user
    with pytest.raises(services.InvalidCredentialsError):
        services.authenticate_user(identifier="amina", password="faux")  # compteur reparti de 0


def test_throttling_ignores_spoofed_forwarded_for(api_client, monkeypatch):
    """Changer X-Forwarded-For à chaque requête ne doit pas remettre le quota à zéro."""
    from core.throttling import OTPThrottle

    monkeypatch.setattr(OTPThrottle, "rate", "3/hour", raising=False)
    codes = [
        api_client.post(
            "/api/accounts/password/reset/",
            {"email": "inconnu@example.com"},
            format="json",
            HTTP_X_FORWARDED_FOR=f"10.0.0.{i}, 203.0.113.7",
        ).status_code
        for i in range(5)
    ]
    assert codes[:3] == [202, 202, 202]
    assert codes[3:] == [429, 429]


def test_sms_login_is_gone(api_client):
    for path in ("/api/accounts/otp/request/", "/api/accounts/otp/verify/"):
        assert (
            api_client.post(path, {"phone_number": "+22890000001"}, format="json").status_code
            == 404
        )


# ── OAuth ──


def test_oauth_neutralizes_password_of_preregistered_account(monkeypatch, make_user):
    """Pré-détournement : un compte créé avec l'e-mail d'autrui ne garde pas son mot de passe
    une fois que la vraie propriétaire de l'adresse se connecte par Google."""
    squatter = make_user("squatteur")
    squatter.email = "victime@example.com"
    squatter.save()
    monkeypatch.setattr(oauth, "fetch_identity", lambda *a, **k: _identity("victime@example.com"))

    user, created = services.login_with_oauth(provider="google", code="c")
    assert user == squatter and not created
    user.refresh_from_db()
    assert not user.has_usable_password()
    with pytest.raises(services.InvalidCredentialsError):
        services.authenticate_user(identifier="squatteur", password="Sup3r-secret-pass")
    assert SocialAccount.objects.filter(user=user, provider="google").exists()


@pytest.fixture
def github_oauth(settings):
    settings.GITHUB_CLIENT_ID = "gh-id"
    settings.GITHUB_CLIENT_SECRET = "gh-secret"
    return settings


def test_intercepted_app_code_is_useless_without_verifier(api_client, github_oauth, monkeypatch):
    """Une autre appli qui capte afridev://oauth?code=… ne peut pas échanger le code."""
    verifier = "v" * 64
    start = api_client.get(
        "/api/accounts/oauth/github/start/",
        {"return_to": "afridev://oauth", "code_verifier": verifier},
    )
    state = parse_qs(urlparse(start["Location"]).query)["state"][0]
    assert verifier not in state  # le state est lisible : il ne garde que l'empreinte
    callback = api_client.get(
        "/api/accounts/oauth/github/callback/", {"code": "abc", "state": state}
    )
    assert callback.status_code == 302

    monkeypatch.setattr(oauth, "fetch_identity", lambda *a, **k: _identity("dev@example.com"))
    stolen = api_client.post("/api/accounts/oauth/github/", {"code": "abc"}, format="json")
    assert stolen.status_code == 400
    wrong = api_client.post(
        "/api/accounts/oauth/github/", {"code": "abc", "code_verifier": "x" * 64}, format="json"
    )
    assert wrong.status_code == 400
    legit = api_client.post(
        "/api/accounts/oauth/github/", {"code": "abc", "code_verifier": verifier}, format="json"
    )
    assert legit.status_code == 200


def test_web_codes_without_verifier_still_work(api_client, github_oauth, monkeypatch):
    monkeypatch.setattr(oauth, "fetch_identity", lambda *a, **k: _identity("web@example.com"))
    response = api_client.post("/api/accounts/oauth/github/", {"code": "web"}, format="json")
    assert response.status_code == 200


def test_production_never_accepts_local_cors_origins_as_oauth_return(settings):
    settings.DEBUG = False
    settings.PUBLIC_WEB_URL = "https://afridev.duckdns.org"
    settings.CORS_ALLOWED_ORIGINS = ["https://afridev.duckdns.org"]
    assert oauth.is_allowed_return("https://afridev.duckdns.org/oauth/callback")
    assert not oauth.is_allowed_return("http://localhost:3000/oauth/callback")
    assert not oauth.is_allowed_return("exp://evil.example/--/oauth")


def test_verified_owner_keeps_password_when_linking_oauth(monkeypatch, make_user):
    owner = make_user("proprio")
    services.mark_email_verified(owner)
    monkeypatch.setattr(oauth, "fetch_identity", lambda *a, **k: _identity("proprio@example.com"))
    user, _ = services.login_with_oauth(provider="google", code="c")
    assert user == owner
    assert services.authenticate_user(identifier="proprio", password="Sup3r-secret-pass") == owner


# ── Session du site en cookie httpOnly ──

WEB = {"HTTP_X_AUTH_MODE": "cookie", "HTTP_ORIGIN": "http://localhost:3000"}


@pytest.fixture
def web_origin(settings):
    settings.PUBLIC_WEB_URL = "http://localhost:3000"


def _web_login(client):
    return client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
        **WEB,
    )


def test_web_refresh_token_never_reaches_javascript(api_client, user, web_origin):
    login = _web_login(api_client)
    assert login.status_code == 200
    assert login.data["tokens"]["access"] and login.data["tokens"]["refresh"] == ""
    cookie = login.cookies[web_session.REFRESH_COOKIE]
    assert cookie["httponly"] and cookie["samesite"] == "Strict"
    assert cookie["path"] == "/api/accounts/"

    # Rechargement de la page : le cookie seul suffit à obtenir un jeton d'accès.
    refreshed = api_client.post("/api/accounts/token/refresh/", {}, format="json", **WEB)
    assert refreshed.status_code == 200
    assert refreshed.data["access"] and refreshed.data["refresh"] == ""
    assert refreshed.cookies[web_session.REFRESH_COOKIE].value  # jeton renouvelé reposé


def test_cookie_refresh_refused_from_foreign_origin(api_client, user, web_origin):
    _web_login(api_client)
    response = api_client.post(
        "/api/accounts/token/refresh/",
        {},
        format="json",
        HTTP_X_AUTH_MODE="cookie",
        HTTP_ORIGIN="https://evil.example",
    )
    assert response.status_code == 403


def test_legacy_web_token_is_migrated_to_cookie(api_client, user, web_origin):
    legacy = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
    ).data["tokens"]["refresh"]
    migrated = api_client.post(
        "/api/accounts/token/refresh/", {"refresh": legacy}, format="json", **WEB
    )
    assert migrated.status_code == 200 and migrated.data["refresh"] == ""
    assert migrated.cookies[web_session.REFRESH_COOKIE].value


def test_mobile_still_receives_both_tokens(api_client, user):
    login = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
    )
    assert login.data["tokens"]["refresh"]
    assert web_session.REFRESH_COOKIE not in login.cookies


def test_logout_revokes_the_session_server_side(api_client, user, web_origin):
    stolen = _web_login(api_client).cookies[web_session.REFRESH_COOKIE].value
    out = api_client.post("/api/accounts/logout/", {}, format="json", **WEB)
    assert out.status_code == 204
    assert out.cookies[web_session.REFRESH_COOKIE].value == ""
    assert (
        api_client.post("/api/accounts/token/refresh/", {}, format="json", **WEB).status_code == 401
    )
    # Même un cookie volé avant la déconnexion ne renouvelle plus rien.
    api_client.cookies[web_session.REFRESH_COOKIE] = stolen
    assert (
        api_client.post("/api/accounts/token/refresh/", {}, format="json", **WEB).status_code == 401
    )


def test_mobile_logout_revokes_its_refresh_token(api_client, user):
    tokens = api_client.post(
        "/api/accounts/login/",
        {"identifier": "amina", "password": "Sup3r-secret-pass"},
        format="json",
    ).data["tokens"]
    assert (
        api_client.post(
            "/api/accounts/logout/", {"refresh": tokens["refresh"]}, format="json"
        ).status_code
        == 204
    )
    again = api_client.post(
        "/api/accounts/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert again.status_code == 401


# ── Vérification de l'adresse e-mail ──


def test_registration_sends_a_verification_link(
    api_client, mailoutbox, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(
            "/api/accounts/register/",
            {"username": "kofi_dev", "email": "kofi@example.com", "password": "Sup3r-secret-pass"},
            format="json",
        )
    assert response.status_code == 201 and response.data["user"]["email_verified"] is False
    token = mailoutbox[-1].body.split("token=")[1].split()[0]

    verified = api_client.post("/api/accounts/email/verify/", {"token": token}, format="json")
    assert verified.status_code == 200 and verified.data["email_verified"] is True


def test_verification_link_is_bound_to_the_address(make_user):
    member = make_user("awa")
    token = signing.dumps(
        {"u": str(member.id), "e": "autre@example.com"}, salt=services.EMAIL_VERIFY_SALT
    )
    with pytest.raises(DomainError):
        services.verify_email(token=token)
    with pytest.raises(DomainError):
        services.verify_email(token="faux")


# ── Mot de passe oublié par code (appli) ──


def _request_code(client, mailoutbox, captured):
    with captured(execute=True):
        assert (
            client.post(
                "/api/accounts/password/reset/", {"email": "amina@example.com"}, format="json"
            ).status_code
            == 202
        )
    body = mailoutbox[-1].body
    return body.split("(valable 15 minutes) :")[1].split()[0]


def _reset(client, code, password="N0uveau-secret-pass"):
    return client.post(
        "/api/accounts/password/reset/code/",
        {"email": "amina@example.com", "code": code, "password": password},
        format="json",
    )


def test_reset_code_logs_in_with_new_password(
    api_client, user, mailoutbox, django_capture_on_commit_callbacks
):
    code = _request_code(api_client, mailoutbox, django_capture_on_commit_callbacks)
    assert len(code) == 6 and code.isdigit()
    response = _reset(api_client, code)
    assert response.status_code == 200 and response.data["tokens"]["access"]
    assert services.authenticate_user(identifier="amina", password="N0uveau-secret-pass") == user
    assert _reset(api_client, code).status_code == 400  # code à usage unique


def test_reset_code_is_burnt_after_five_wrong_tries(
    api_client, user, mailoutbox, django_capture_on_commit_callbacks
):
    code = _request_code(api_client, mailoutbox, django_capture_on_commit_callbacks)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(services.RESET_CODE_ATTEMPTS):
        assert _reset(api_client, wrong).status_code == 400
    assert _reset(api_client, code).status_code == 400  # brûlé : même le bon code ne passe plus


def test_reset_code_for_unknown_email_reveals_nothing(api_client):
    response = api_client.post(
        "/api/accounts/password/reset/code/",
        {"email": "personne@example.com", "code": "123456", "password": "N0uveau-secret-pass"},
        format="json",
    )
    assert response.status_code == 400 and response.data["error"]["code"] == "invalid_reset"
