import time

import pytest
from rest_framework.test import APIClient

from features.accounts import totp

pytestmark = pytest.mark.django_db(transaction=True)

PASSWORD = "Sup3r-secret-pass"


def _login(identifier="amina", agent="Mozilla/5.0 (Windows NT 10.0) Chrome/130.0"):
    client = APIClient(HTTP_USER_AGENT=agent)
    response = client.post(
        "/api/accounts/login/", {"identifier": identifier, "password": PASSWORD}, format="json"
    )
    return client, response


def _bearer(access):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client


def test_sessions_list_and_revoke(user):
    _, laptop = _login()
    _, phone = _login(agent="okhttp/4.9 (Android 14)")
    laptop_client = _bearer(laptop.data["tokens"]["access"])

    sessions = laptop_client.get("/api/accounts/sessions/").data
    assert len(sessions) == 2
    current = next(s for s in sessions if s["current"])
    assert current["device"] == "Chrome · Windows"
    other = next(s for s in sessions if not s["current"])
    assert other["device"] == "Application mobile · Android"

    assert laptop_client.delete(f"/api/accounts/sessions/{other['id']}/").status_code == 204
    # Le téléphone est déconnecté : accès refusé tout de suite, renouvellement refusé.
    assert _bearer(phone.data["tokens"]["access"]).get("/api/accounts/me/").status_code == 401
    refresh = APIClient().post(
        "/api/accounts/token/refresh/", {"refresh": phone.data["tokens"]["refresh"]}, format="json"
    )
    assert refresh.status_code == 401
    # L'ordinateur, lui, renouvelle normalement.
    ok = APIClient().post(
        "/api/accounts/token/refresh/", {"refresh": laptop.data["tokens"]["refresh"]}, format="json"
    )
    assert ok.status_code == 200

    _login()
    revoked = laptop_client.post("/api/accounts/sessions/revoke-others/")
    assert revoked.data == {"revoked": 1}
    assert len(laptop_client.get("/api/accounts/sessions/").data) == 1


def test_two_factor_login(user):
    client, first = _login()
    authed = _bearer(first.data["tokens"]["access"])
    setup = authed.post("/api/accounts/2fa/setup/").data
    assert setup["otpauth_url"].startswith("otpauth://totp/AfriDev%20Exchange")
    assert "<svg" in setup["qr_svg"]
    secret = setup["secret"]

    wrong = authed.post("/api/accounts/2fa/enable/", {"code": "000000"}, format="json")
    assert wrong.status_code == 400
    step = totp.current_step()
    enabled = authed.post(
        "/api/accounts/2fa/enable/", {"code": totp._code(secret, step)}, format="json"
    )
    assert enabled.data["two_factor_enabled"] is True

    _, challenge = _login()
    assert challenge.data["mfa_required"] is True and challenge.data["tokens"] is None
    replay = APIClient().post(
        "/api/accounts/login/2fa/",
        {"mfa_token": challenge.data["mfa_token"], "code": totp._code(secret, step)},
        format="json",
    )
    assert replay.status_code == 400  # un code déjà utilisé est refusé
    done = APIClient().post(
        "/api/accounts/login/2fa/",
        {"mfa_token": challenge.data["mfa_token"], "code": totp._code(secret, step + 1)},
        format="json",
    )
    assert done.status_code == 200 and done.data["tokens"]["access"]
    forged = APIClient().post(
        "/api/accounts/login/2fa/", {"mfa_token": "faux", "code": "123456"}, format="json"
    )
    assert forged.status_code == 400


def test_totp_matches_rfc6238_vector():
    # RFC 6238, annexe B : secret ASCII « 12345678901234567890 », T = 59 s → 94287082 (8 chiffres).
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert totp._code(secret, 59 // 30) == "287082"
    assert totp.matching_step(secret, "287082", at=59) == 1
    assert totp.matching_step(secret, "287082", at=time.time()) is None


def test_personal_access_tokens(auth_client, user):
    created = auth_client.post(
        "/api/accounts/tokens/", {"name": "CI GitHub", "read_only": True}, format="json"
    )
    assert created.status_code == 201
    raw = created.data["token"]
    assert raw.startswith("afd_") and created.data["prefix"] == raw[:10]
    listed = auth_client.get("/api/accounts/tokens/").data
    assert "token" not in listed[0]  # la valeur n'est plus jamais renvoyée

    api = _bearer(raw)
    assert api.get("/api/accounts/me/").data["username"] == "amina"
    write = api.post("/api/feed/", {"title": "Via jeton", "body": "…"}, format="json")
    assert write.status_code == 403  # lecture seule
    assert api.get("/api/accounts/tokens/").status_code == 403  # pas de gestion via un jeton

    assert auth_client.delete(f"/api/accounts/tokens/{created.data['id']}/").status_code == 204
    assert api.get("/api/accounts/me/").status_code == 401


def test_data_export(auth_client, user):
    auth_client.post("/api/feed/", {"title": "Exporté", "body": "…"}, format="json")
    auth_client.post("/api/accounts/tokens/", {"name": "Script"}, format="json")
    response = auth_client.get("/api/accounts/me/export/")
    assert response.status_code == 200
    assert "attachment" in response["Content-Disposition"]
    data = response.json()
    assert data["account"]["username"] == "amina"
    assert [p["title"] for p in data["posts"]] == ["Exporté"]
    assert data["profile"]["username"] == "amina"
    assert "token_hash" not in str(data) and "password" not in str(data)
