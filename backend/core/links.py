"""Aperçu d'un lien externe (titre, description, image) et possibilité de l'afficher dans un cadre.

Sert la visionneuse interne du site : les liens s'ouvrent dans la plateforme, en cadre quand le
site l'autorise, sinon sous forme d'aperçu. Protégé contre le SSRF : seules les adresses
publiques sont contactées, à chaque redirection.
"""

import ipaddress
import re
import socket
from html import unescape
from urllib.parse import urljoin, urlsplit

import httpx
from django.core.cache import cache

MAX_BYTES = 400_000
MAX_REDIRECTS = 3
TIMEOUT = 5.0
CACHE_SECONDS = 6 * 3600
USER_AGENT = "Mozilla/5.0 (compatible; AfriDevLinkPreview/1.0; +https://afridev.duckdns.org)"


class UnsafeURL(ValueError):
    pass


def _check_public(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise UnsafeURL("Seuls les liens http et https sont acceptés.")
    try:
        infos = socket.getaddrinfo(parts.hostname, parts.port or None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeURL("Adresse introuvable.") from exc
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global or address.is_multicast:
            raise UnsafeURL("Adresse non publique refusée.")


def _meta(html: str, *names: str) -> str:
    for name in names:
        pattern = (
            r"<meta[^>]+(?:property|name)=[\"']"
            + re.escape(name)
            + r"[\"'][^>]*content=[\"']([^\"']*)"
        )
        match = re.search(pattern, html, re.I)
        if not match:
            pattern = (
                r"<meta[^>]+content=[\"']([^\"']*)[\"'][^>]*(?:property|name)=[\"']"
                + re.escape(name)
                + r"[\"']"
            )
            match = re.search(pattern, html, re.I)
        if match and match.group(1).strip():
            return unescape(match.group(1).strip())
    return ""


def _frameable(headers: httpx.Headers) -> bool:
    """Le site accepte-t-il d'être affiché dans un cadre d'un autre domaine ?"""
    if headers.get("x-frame-options"):
        return False
    csp = headers.get("content-security-policy", "")
    match = re.search(r"frame-ancestors([^;]*)", csp, re.I)
    if match:
        sources = match.group(1).split()
        return "*" in sources
    return True


def preview(url: str) -> dict:
    url = url.strip()
    cached = cache.get(f"link-preview:{url}")
    if cached:
        return cached
    current = url
    with httpx.Client(
        timeout=TIMEOUT, follow_redirects=False, headers={"User-Agent": USER_AGENT}
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            _check_public(current)
            with client.stream("GET", current) as response:
                if response.is_redirect and response.headers.get("location"):
                    current = urljoin(current, response.headers["location"])
                    continue
                body = b""
                content_type = response.headers.get("content-type", "")
                if "html" in content_type:
                    for chunk in response.iter_bytes():
                        body += chunk
                        if len(body) >= MAX_BYTES:
                            break
                headers = response.headers
                status = response.status_code
            break
        else:
            raise UnsafeURL("Trop de redirections.")
    html = body.decode("utf-8", errors="ignore")
    title_tag = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    image = _meta(html, "og:image", "twitter:image")
    title = _meta(html, "og:title", "twitter:title")
    if not title and title_tag:
        title = unescape(" ".join(title_tag.group(1).split()))
    result = {
        "url": url,
        "final_url": current,
        "status": status,
        "title": title[:300],
        "description": _meta(html, "og:description", "description", "twitter:description")[:500],
        "image": urljoin(current, image) if image else "",
        "site_name": _meta(html, "og:site_name") or (urlsplit(current).hostname or ""),
        "frameable": _frameable(headers) and urlsplit(current).scheme == "https",
    }
    cache.set(f"link-preview:{url}", result, CACHE_SECONDS)
    return result
