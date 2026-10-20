"""Non-régression : SSRF de l'aperçu de liens."""

import socket

import pytest

from core import links


def _resolver(*addresses):
    def fake_getaddrinfo(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0)) for address in addresses]

    return fake_getaddrinfo


@pytest.mark.parametrize(
    "address",
    ["127.0.0.1", "10.0.0.5", "172.18.0.4", "192.168.1.1", "169.254.169.254", "0.0.0.0"],
)
def test_private_addresses_are_refused(monkeypatch, address):
    monkeypatch.setattr(socket, "getaddrinfo", _resolver(address))
    with pytest.raises(links.UnsafeURL):
        links._resolve_public("https://piege.example/")


def test_one_private_address_among_public_ones_is_refused(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _resolver("93.184.216.34", "127.0.0.1"))
    with pytest.raises(links.UnsafeURL):
        links._resolve_public("https://piege.example/")


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/",
        "file:///etc/passwd",
        "https://example.com:6379/",
        "http://example.com:8000/",
    ],
)
def test_non_web_schemes_and_ports_are_refused(monkeypatch, url):
    monkeypatch.setattr(socket, "getaddrinfo", _resolver("93.184.216.34"))
    with pytest.raises(links.UnsafeURL):
        links._resolve_public(url)


def test_connection_is_pinned_to_the_checked_address(monkeypatch):
    """DNS rebinding : on se connecte à l'IP contrôlée, pas à une nouvelle résolution du nom."""
    monkeypatch.setattr(socket, "getaddrinfo", _resolver("93.184.216.34"))
    ip = links._resolve_public("https://user:pw@exemple.org/page?q=1")
    target, headers, extensions = links._pinned_request("https://user:pw@exemple.org/page?q=1", ip)
    assert target == "https://93.184.216.34/page?q=1"
    assert headers == {"Host": "exemple.org"}
    assert extensions == {"sni_hostname": "exemple.org"}


def test_preview_never_reconnects_to_a_rebound_name(monkeypatch):
    calls = []

    def rebinding_resolver(host, port, *args, **kwargs):
        # 1re résolution publique, puis 127.0.0.1 : la requête doit viser l'IP publique contrôlée.
        calls.append(host)
        address = "93.184.216.34" if len(calls) == 1 else "127.0.0.1"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0))]

    monkeypatch.setattr(socket, "getaddrinfo", rebinding_resolver)
    requested = []

    class FakeResponse:
        is_redirect = False
        headers = {"content-type": "text/plain"}
        status_code = 200

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_stream(self, method, url, **kwargs):
        requested.append(url)
        return FakeResponse()

    monkeypatch.setattr(links.httpx.Client, "stream", fake_stream)
    links.preview("https://rebind.example/")
    assert requested == ["https://93.184.216.34/"]
