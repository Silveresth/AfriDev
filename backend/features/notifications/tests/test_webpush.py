import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from core.exceptions import DomainError
from features.notifications import services
from features.notifications.models import PushDevice, WebPushSubscription
from integrations import push
from integrations.push import webpush

pytestmark = pytest.mark.django_db(transaction=True)

FCM = "https://fcm.googleapis.com/fcm/send/"


@pytest.fixture
def vapid(settings):
    settings.WEBPUSH_VAPID_PRIVATE_KEY = push.generate_private_key()
    return settings


def _browser_keys() -> dict:
    """Clés d'un faux navigateur (p256dh, auth), comme PushSubscription.toJSON()."""
    key = ec.generate_private_key(ec.SECP256R1())
    raw = key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return {
        "p256dh": webpush.b64url_encode(raw),
        "auth": webpush.b64url_encode(b"0123456789abcdef"),
    }


def _mock_http(monkeypatch, handler):
    real = httpx.Client
    monkeypatch.setattr(
        webpush.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    )


def test_config_exposes_public_key_only_when_configured(auth_client, vapid):
    data = auth_client.get("/api/notifications/web-push/").data
    assert len(webpush.b64url_decode(data["public_key"])) == 65
    vapid.WEBPUSH_VAPID_PRIVATE_KEY = ""
    assert auth_client.get("/api/notifications/web-push/").data == {"public_key": None}


def test_subscribe_rejects_unknown_hosts_and_keeps_recent(auth_client, user, vapid):
    vapid.WEBPUSH_MAX_SUBSCRIPTIONS = 2
    for name in ("a", "b", "c"):
        response = auth_client.post(
            "/api/notifications/web-push/",
            {"endpoint": FCM + name, "keys": _browser_keys()},
            format="json",
        )
        assert response.status_code == 204
    endpoints = set(WebPushSubscription.objects.values_list("endpoint", flat=True))
    assert endpoints == {FCM + "b", FCM + "c"}

    # Hôte interne : refusé (le serveur appellerait cette URL).
    with pytest.raises(DomainError):
        services.subscribe_webpush(
            user=user, endpoint="https://169.254.169.254/latest", **_browser_keys()
        )

    auth_client.post(
        "/api/notifications/web-push/unsubscribe/", {"endpoint": FCM + "c"}, format="json"
    )
    assert WebPushSubscription.objects.count() == 1


def test_notification_is_pushed_to_browsers_and_expired_ones_removed(user, vapid, monkeypatch):
    services.subscribe_webpush(user=user, endpoint=FCM + "live", **_browser_keys())
    services.subscribe_webpush(user=user, endpoint=FCM + "gone", **_browser_keys())
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        return httpx.Response(410 if request.url.path.endswith("gone") else 201)

    _mock_http(monkeypatch, handler)
    services.notify(recipient_id=user.id, kind="new_answer", title="Nouvelle réponse")

    assert len(requests) == 2
    sent = requests[0]
    assert sent.headers["Content-Encoding"] == "aes128gcm"
    assert sent.headers["Authorization"].startswith("vapid t=")
    assert list(WebPushSubscription.objects.values_list("endpoint", flat=True)) == [FCM + "live"]


def test_push_disabled_by_preference_skips_browsers(user, vapid, monkeypatch):
    services.subscribe_webpush(user=user, endpoint=FCM + "x", **_browser_keys())
    services.update_preferences(user=user, push_enabled=False)
    calls = []
    _mock_http(monkeypatch, lambda request: calls.append(request) or httpx.Response(201))
    services.notify(recipient_id=user.id, kind="new_answer", title="Coupé")
    assert calls == []


def test_mobile_device_unregisters_without_session(api_client, user):
    services.register_device(user=user, token="ExponentPushToken[phone]", platform="android")
    response = api_client.post(
        "/api/notifications/devices/unregister/",
        {"token": "ExponentPushToken[phone]"},
        format="json",
    )
    assert response.status_code == 204
    assert not PushDevice.objects.exists()


def test_outage_raises_for_retry(vapid, monkeypatch):
    _mock_http(monkeypatch, lambda request: httpx.Response(503))
    with pytest.raises(push.PushError):
        push.send_webpush(
            subscriptions=[{"endpoint": FCM + "x", **_browser_keys()}],
            message={"title": "t", "body": "b"},
        )
