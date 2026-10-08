"""Actualité tech externe : Hacker News (Firebase + Algolia), DEV.to et flux RSS / Atom.

APIs publiques, gratuites, en lecture seule et sans clé. On ne garde que le titre, un court
extrait et le lien vers l'article d'origine (le contenu reste chez l'éditeur).
"""

import html
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx

HN_API = "https://hacker-news.firebaseio.com/v0"
HN_SEARCH_API = "https://hn.algolia.com/api/v1"
HN_ITEM_URL = "https://news.ycombinator.com/item?id={id}"
DEVTO_API = "https://dev.to/api"

USER_AGENT = "AfriDevExchange/1.0 (+https://afridev.exchange)"
TIMEOUT = 8
# Un flux RSS dépasse rarement quelques centaines de Ko : au-delà, on ignore la réponse.
MAX_FEED_BYTES = 3 * 1024 * 1024
EXCERPT_LENGTH = 240


@dataclass(frozen=True)
class Feed:
    slug: str
    name: str
    url: str
    lang: str


# Médias tech lus côté serveur (les applis n'appellent jamais ces sites directement).
RSS_FEEDS: tuple[Feed, ...] = (
    Feed("techcrunch", "TechCrunch", "https://techcrunch.com/feed/", "en"),
    Feed("theverge", "The Verge", "https://www.theverge.com/rss/index.xml", "en"),
    Feed("arstechnica", "Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", "en"),
    Feed("numerama", "Numerama", "https://www.numerama.com/feed/", "fr"),
    Feed("frandroid", "Frandroid", "https://www.frandroid.com/feed", "fr"),
)


class TechNewsError(Exception):
    pass


@dataclass
class NewsItem:
    id: str
    source: str  # hackernews | devto | rss
    source_name: str
    title: str
    url: str
    excerpt: str = ""
    author: str = ""
    image_url: str = ""
    lang: str = "en"
    score: int | None = None
    comment_count: int | None = None
    discussion_url: str = ""
    tags: list[str] = field(default_factory=list)
    published_at: datetime | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def _client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT, follow_redirects=True, headers={"User-Agent": USER_AGENT})


def _get_json(client: httpx.Client, url: str, **params):
    try:
        response = client.get(url, params=params or None)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise TechNewsError(f"{url} : {exc}") from exc


_TAGS = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"\s+")


def clean_excerpt(raw: str, length: int = EXCERPT_LENGTH) -> str:
    """HTML -> texte brut, coupé proprement au dernier mot avant `length` caractères."""
    text = _SPACES.sub(" ", html.unescape(_TAGS.sub(" ", raw or ""))).strip()
    if len(text) <= length:
        return text
    cut = text[:length].rsplit(" ", 1)[0].rstrip(" ,;:.-–—")
    return f"{cut}…"


def _from_timestamp(value) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value), tz=UTC)
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def _from_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _from_rfc822(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value.strip())
    except (TypeError, ValueError, IndexError):
        return _from_iso(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


# ── Hacker News ──


def _hn_story(raw: dict) -> NewsItem | None:
    if not raw or raw.get("type") != "story" or raw.get("dead") or raw.get("deleted"):
        return None
    item_id = raw["id"]
    discussion = HN_ITEM_URL.format(id=item_id)
    return NewsItem(
        id=f"hn-{item_id}",
        source="hackernews",
        source_name="Hacker News",
        title=html.unescape(raw.get("title", "")),
        # Les « Ask HN » n'ont pas de lien externe : on renvoie vers la discussion.
        url=raw.get("url") or discussion,
        excerpt=clean_excerpt(raw.get("text", "")),
        author=raw.get("by", ""),
        score=raw.get("score"),
        comment_count=raw.get("descendants"),
        discussion_url=discussion,
        published_at=_from_timestamp(raw.get("time")),
    )


def hacker_news_top(limit: int = 30) -> list[NewsItem]:
    """Meilleures histoires du moment (API officielle Firebase)."""
    with _client() as client:
        ids = _get_json(client, f"{HN_API}/topstories.json")[:limit]

        def fetch(story_id):
            try:
                return _get_json(client, f"{HN_API}/item/{story_id}.json")
            except TechNewsError:
                return None

        with ThreadPoolExecutor(max_workers=10) as pool:
            raws = list(pool.map(fetch, ids))
    return [story for story in map(_hn_story, raws) if story]


def hacker_news_search(query: str, limit: int = 30) -> list[NewsItem]:
    """Recherche plein texte (API Algolia de Hacker News)."""
    with _client() as client:
        data = _get_json(
            client, f"{HN_SEARCH_API}/search", query=query, tags="story", hitsPerPage=limit
        )
    stories = []
    for hit in data.get("hits", []):
        story = _hn_story(
            {
                "id": hit.get("objectID"),
                "type": "story",
                "title": hit.get("title") or hit.get("story_title") or "",
                "url": hit.get("url"),
                "text": hit.get("story_text") or "",
                "by": hit.get("author", ""),
                "score": hit.get("points"),
                "descendants": hit.get("num_comments"),
                "time": hit.get("created_at_i"),
            }
        )
        if story and story.title:
            stories.append(story)
    return stories


# ── DEV.to ──


def _devto_article(raw: dict) -> NewsItem:
    tags = raw.get("tag_list") or []
    if isinstance(tags, str):
        tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
    user = raw.get("user") or {}
    return NewsItem(
        id=f"devto-{raw['id']}",
        source="devto",
        source_name="DEV",
        title=raw.get("title", ""),
        url=raw.get("url", ""),
        excerpt=clean_excerpt(raw.get("description", "")),
        author=user.get("name") or user.get("username", ""),
        image_url=raw.get("cover_image") or "",
        lang="en",
        score=raw.get("public_reactions_count", raw.get("positive_reactions_count")),
        comment_count=raw.get("comments_count"),
        discussion_url=raw.get("url", ""),
        tags=list(tags)[:4],
        published_at=_from_iso(raw.get("published_at")),
    )


def devto_articles(limit: int = 30, tag: str = "") -> list[NewsItem]:
    """Articles populaires de la semaine (tutoriels, retours d'expérience)."""
    params = {"per_page": limit, "top": 7}
    if tag:
        params["tag"] = tag
    with _client() as client:
        data = _get_json(client, f"{DEVTO_API}/articles", **params)
    return [_devto_article(raw) for raw in data if raw.get("id") and raw.get("url")]


# ── RSS 2.0 / Atom ──

_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "dc": "http://purl.org/dc/elements/1.1/",
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}
_IMG_SRC = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)


def _text(node: ET.Element | None, path: str) -> str:
    if node is None:
        return ""
    found = node.find(path, _NS)
    return (found.text or "").strip() if found is not None else ""


def _rss_image(item: ET.Element, body: str) -> str:
    for path in ("media:content", "media:thumbnail"):
        media = item.find(path, _NS)
        if media is not None and media.get("url"):
            return media.get("url", "")
    enclosure = item.find("enclosure")
    if enclosure is not None and (enclosure.get("type") or "").startswith("image/"):
        return enclosure.get("url", "")
    match = _IMG_SRC.search(body)
    return match.group(1) if match else ""


def parse_feed(xml: bytes | str, feed: Feed, limit: int = 20) -> list[NewsItem]:
    """Lit un flux RSS 2.0 ou Atom. Les flux mal formés lèvent TechNewsError."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        raise TechNewsError(f"{feed.name} : flux illisible ({exc})") from exc

    items: list[NewsItem] = []
    if root.tag == f"{{{_NS['atom']}}}feed":
        for entry in root.findall("atom:entry", _NS)[:limit]:
            link = ""
            for candidate in entry.findall("atom:link", _NS):
                if candidate.get("rel", "alternate") == "alternate":
                    link = candidate.get("href", "")
                    break
            body = _text(entry, "atom:summary") or _text(entry, "atom:content")
            title = clean_excerpt(_text(entry, "atom:title"), 300)
            if not (title and link):
                continue
            items.append(
                NewsItem(
                    id=f"{feed.slug}-{_text(entry, 'atom:id') or link}",
                    source="rss",
                    source_name=feed.name,
                    title=title,
                    url=link,
                    excerpt=clean_excerpt(body),
                    author=_text(entry, "atom:author/atom:name"),
                    image_url=_rss_image(entry, body),
                    lang=feed.lang,
                    published_at=_from_iso(
                        _text(entry, "atom:published") or _text(entry, "atom:updated")
                    ),
                )
            )
        return items

    for item in root.findall("./channel/item")[:limit]:
        link = _text(item, "link")
        title = clean_excerpt(_text(item, "title"), 300)
        if not (title and link):
            continue
        body = _text(item, "description") or _text(item, "content:encoded")
        items.append(
            NewsItem(
                id=f"{feed.slug}-{_text(item, 'guid') or link}",
                source="rss",
                source_name=feed.name,
                title=title,
                url=link,
                excerpt=clean_excerpt(body),
                author=_text(item, "dc:creator") or _text(item, "author"),
                image_url=_rss_image(item, body + _text(item, "content:encoded")),
                lang=feed.lang,
                published_at=_from_rfc822(_text(item, "pubDate")),
            )
        )
    return items


def rss_feed(feed: Feed, limit: int = 20) -> list[NewsItem]:
    with _client() as client:
        try:
            response = client.get(feed.url)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise TechNewsError(f"{feed.name} : {exc}") from exc
    if len(response.content) > MAX_FEED_BYTES:
        raise TechNewsError(f"{feed.name} : flux trop volumineux")
    return parse_feed(response.content, feed, limit=limit)
