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


DEFAULT_PORTS = {"http": 80, "https": 443}


def _resolve_public(url: str) -> str:
    """Adresse IP publique à contacter pour `url` (contrôlée puis réutilisée telle quelle).

    Se connecter à l'IP vérifiée, et non au nom, ferme la faille du « DNS rebinding » : un
    domaine piégé ne peut pas répondre une IP publique au contrôle puis 127.0.0.1 (ou un
    conteneur interne) au moment de la connexion. Seuls les ports web standard sont admis.
    """
    parts = urlsplit(url)
    if parts.scheme not in DEFAULT_PORTS or not parts.hostname:
        raise UnsafeURL("Seuls les liens http et https sont acceptés.")
    try:
        port = parts.port
    except ValueError as exc:
        raise UnsafeURL("Port invalide.") from exc
    if port not in (None, DEFAULT_PORTS[parts.scheme]):
        raise UnsafeURL("Port non standard refusé.")
    try:
        infos = socket.getaddrinfo(parts.hostname, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError) as exc:
        raise UnsafeURL("Adresse introuvable.") from exc
    addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not addresses or any(not a.is_global or a.is_multicast for a in addresses):
        raise UnsafeURL("Adresse non publique refusée.")
    return str(addresses[0])


def _pinned_request(url: str, ip: str) -> tuple[str, dict, dict]:
    """URL réécrite vers l'IP vérifiée ; Host et SNI gardent le nom (certificat contrôlé)."""
    parts = urlsplit(url)
    host = f"[{ip}]" if ":" in ip else ip
    target = parts._replace(netloc=host).geturl()
    headers = {"Host": parts.hostname}
    extensions = {"sni_hostname": parts.hostname} if parts.scheme == "https" else {}
    return target, headers, extensions


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


def _fetch(url: str, *, accept: tuple[str, ...] = ("html",)) -> tuple[str, int, httpx.Headers, str]:
    """(adresse finale, statut, en-têtes, corps texte) ; le corps n'est lu que si son type
    contient l'un des mots de `accept` (html, json…), et jamais au-delà de MAX_BYTES."""
    current = url
    with httpx.Client(
        timeout=TIMEOUT, follow_redirects=False, headers={"User-Agent": USER_AGENT}
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            ip = _resolve_public(current)
            target, request_headers, extensions = _pinned_request(current, ip)
            with client.stream(
                "GET", target, headers=request_headers, extensions=extensions
            ) as response:
                if response.is_redirect and response.headers.get("location"):
                    current = urljoin(current, response.headers["location"])
                    continue
                body = b""
                content_type = response.headers.get("content-type", "")
                if any(kind in content_type for kind in accept):
                    for chunk in response.iter_bytes():
                        body += chunk
                        if len(body) >= MAX_BYTES:
                            break
                headers = response.headers
                status = response.status_code
            break
        else:
            raise UnsafeURL("Trop de redirections.")
    return current, status, headers, body.decode("utf-8", errors="ignore")


def preview(url: str) -> dict:
    url = url.strip()
    cached = cache.get(f"link-preview:{url}")
    if cached:
        return cached
    current, status, headers, html = _fetch(url)
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


# ── Contenu d'une page (carte d'un post « ressource » et résumé IA) ──

MAX_TEXT_CHARS = 8000
_DROPPED = re.compile(
    r"<(script|style|noscript|svg|nav|footer|form|aside|template)\b[^>]*>.*?</\1\s*>", re.I | re.S
)
_BLOCKS = re.compile(r"<(h[1-3]|p|li|pre|blockquote)\b[^>]*>(.*?)</\1\s*>", re.I | re.S)
_TAGS = re.compile(r"<[^>]+>")
_YOUTUBE = re.compile(r"^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)$", re.I)


def _page_text(html: str) -> tuple[str, int]:
    """Texte lisible de la page (titres, paragraphes, listes) et nombre de mots de l'article."""
    html = _DROPPED.sub(" ", html)
    parts = []
    for match in _BLOCKS.finditer(html):
        text = " ".join(unescape(_TAGS.sub(" ", match.group(2))).split())
        # Les menus et boutons restés dans la page font des blocs très courts.
        if len(text) >= 40 or match.group(1).lower().startswith("h"):
            parts.append(text)
    text = "\n".join(parts)
    return text[:MAX_TEXT_CHARS], len(text.split())


def _youtube(url: str) -> dict:
    """Vidéo YouTube : l'oEmbed officiel (la page renvoie souvent un écran de consentement)."""
    from json import JSONDecodeError, loads
    from urllib.parse import quote

    _, status, _, body = _fetch(
        f"https://www.youtube.com/oembed?format=json&url={quote(url, safe='')}", accept=("json",)
    )
    try:
        data = loads(body) if status == 200 else {}
    except JSONDecodeError:
        data = {}
    author = str(data.get("author_name") or "")
    return {
        "url": url,
        "final_url": url,
        "status": status,
        "kind": "video",
        "title": str(data.get("title") or "")[:300],
        "description": f"Vidéo de {author}"[:500] if author else "",
        "image": str(data.get("thumbnail_url") or ""),
        "site_name": "YouTube",
        "text": "",
        "words": 0,
    }


def page(url: str) -> dict:
    """Aperçu complet d'une ressource : titre, description, image, site, texte de l'article
    (pour le résumé IA) et nombre de mots. Mêmes protections SSRF que `preview`."""
    url = url.strip()
    if _YOUTUBE.match(urlsplit(url).hostname or ""):
        return _youtube(url)
    current, status, _, html = _fetch(url)
    title_tag = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = _meta(html, "og:title", "twitter:title")
    if not title and title_tag:
        title = unescape(" ".join(title_tag.group(1).split()))
    image = _meta(html, "og:image", "twitter:image", "twitter:image:src")
    text, words = _page_text(html)
    return {
        "url": url,
        "final_url": current,
        "status": status,
        "kind": "video" if _meta(html, "og:type").startswith("video") else "article",
        "title": title[:300],
        "description": _meta(html, "og:description", "description", "twitter:description")[:500],
        "image": urljoin(current, image) if image else "",
        "site_name": _meta(html, "og:site_name") or (urlsplit(current).hostname or ""),
        "text": text,
        "words": words,
    }
