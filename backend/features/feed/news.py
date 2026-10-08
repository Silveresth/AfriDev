"""Fil « Actu tech » : Hacker News, DEV.to et médias tech (RSS), mis en cache.

Chaque source est lue au plus une fois toutes les 10 minutes, quel que soit le nombre de
lecteurs ; une source en panne est simplement absente du fil (réessayée une minute plus tard).
"""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from itertools import zip_longest

from django.core.cache import cache

from integrations.technews import client as technews

logger = logging.getLogger(__name__)

SOURCES = ("all", "hackernews", "devto", "rss")
LANGS = ("", "fr", "en")
CACHE_TTL = 10 * 60
ERROR_TTL = 60
MAX_ITEMS = 60

_EPOCH = datetime.min.replace(tzinfo=UTC)


def _cached(key: str, loader) -> list[dict]:
    rows = cache.get(key)
    if rows is not None:
        return rows
    try:
        rows = [item.as_dict() for item in loader()]
        ttl = CACHE_TTL
    except technews.TechNewsError as exc:
        logger.warning("Actu tech indisponible (%s) : %s", key, exc)
        rows, ttl = [], ERROR_TTL
    cache.set(key, rows, ttl)
    return rows


def _hacker_news() -> list[dict]:
    return _cached("technews:hn:top", technews.hacker_news_top)


def _devto() -> list[dict]:
    return _cached("technews:devto:top", technews.devto_articles)


def _rss(lang: str) -> list[dict]:
    feeds = [feed for feed in technews.RSS_FEEDS if not lang or feed.lang == lang]
    with ThreadPoolExecutor(max_workers=len(feeds) or 1) as pool:
        batches = pool.map(
            lambda feed: _cached(f"technews:rss:{feed.slug}", lambda: technews.rss_feed(feed)),
            feeds,
        )
        return [row for batch in batches for row in batch]


def _newest_first(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda row: row.get("published_at") or _EPOCH, reverse=True)


def _interleave(rows: list[dict]) -> list[dict]:
    """Fil « Tout » : HN, DEV et médias à tour de rôle (chacun du plus récent au plus ancien).
    Un simple tri par date laisserait les cinq flux RSS, très prolifiques, tout occuper."""
    groups: dict[str, list[dict]] = {}
    for row in _newest_first(rows):
        groups.setdefault(row["source"], []).append(row)
    mixed = []
    for batch in zip_longest(*groups.values()):
        mixed.extend(row for row in batch if row is not None)
    return mixed


def _matches(row: dict, query: str) -> bool:
    haystack = f"{row['title']} {row['excerpt']} {' '.join(row['tags'])}".lower()
    return all(word in haystack for word in query.lower().split())


def tech_news(*, source: str = "all", lang: str = "", q: str = "") -> list[dict]:
    """Articles les plus récents d'abord (sources alternées pour « all »). `lang` ne filtre que
    les médias (HN et DEV.to sont en anglais) ; `q` interroge la recherche Algolia de Hacker News
    et filtre le reste."""
    source = source if source in SOURCES else "all"
    lang = lang if lang in LANGS else ""
    query = q.strip()[:100]

    loaders = []
    if source in ("all", "hackernews") and lang != "fr":
        if query:
            loaders.append(
                lambda: _cached(
                    f"technews:hn:search:{query.lower()}",
                    lambda: technews.hacker_news_search(query),
                )
            )
        else:
            loaders.append(_hacker_news)
    if source in ("all", "devto") and lang != "fr":
        loaders.append(_devto)
    if source in ("all", "rss"):
        loaders.append(lambda: _rss(lang))

    # Les sources sont lues en parallèle : le fil complet ne coûte que la plus lente.
    with ThreadPoolExecutor(max_workers=len(loaders) or 1) as pool:
        batches = list(pool.map(lambda load: load(), loaders))

    rows = [row for batch in batches for row in batch]
    if query:
        rows = [row for row in rows if row["source"] == "hackernews" or _matches(row, query)]
    ordered = _interleave(rows) if source == "all" else _newest_first(rows)
    return ordered[:MAX_ITEMS]
