from datetime import UTC, datetime

import pytest

from integrations.technews import client as technews

pytestmark = pytest.mark.django_db

RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Numerama</title>
    <item>
      <title>Le Togo lance son cloud souverain</title>
      <link>https://www.numerama.com/tech/cloud-togo</link>
      <guid>https://www.numerama.com/?p=1</guid>
      <dc:creator>Awa</dc:creator>
      <pubDate>Tue, 06 Oct 2026 08:00:00 +0000</pubDate>
      <description><![CDATA[<p><img src="https://img.numerama.com/a.jpg" />
        Un <b>datacenter</b> &amp; des d\xc3\xa9veloppeurs.</p>]]></description>
    </item>
    <item><title>Sans lien</title></item>
  </channel>
</rss>"""

ATOM = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Verge</title>
  <entry>
    <title>A new phone</title>
    <id>tag:theverge.com,2026:1</id>
    <link rel="alternate" type="text/html" href="https://www.theverge.com/phone" />
    <published>2026-10-07T10:30:00Z</published>
    <author><name>Sam</name></author>
    <summary type="html">&lt;p&gt;Short summary&lt;/p&gt;</summary>
  </entry>
</feed>"""

NUMERAMA = technews.Feed("numerama", "Numerama", "https://example.test/feed", "fr")
VERGE = technews.Feed("theverge", "The Verge", "https://example.test/atom", "en")


def item(source, title, day, **extra):
    return technews.NewsItem(
        id=f"{source}-{title}",
        source=source,
        source_name=source,
        title=title,
        url=f"https://example.test/{title}",
        published_at=datetime(2026, 10, day, tzinfo=UTC),
        **extra,
    )


def test_parse_rss_keeps_title_excerpt_link_and_image():
    [row] = technews.parse_feed(RSS, NUMERAMA)
    assert row.title == "Le Togo lance son cloud souverain"
    assert row.url == "https://www.numerama.com/tech/cloud-togo"
    assert row.excerpt == "Un datacenter & des développeurs."
    assert row.image_url == "https://img.numerama.com/a.jpg"
    assert row.author == "Awa"
    assert row.lang == "fr"
    assert row.published_at == datetime(2026, 10, 6, 8, tzinfo=UTC)


def test_parse_atom():
    [row] = technews.parse_feed(ATOM, VERGE)
    assert (row.title, row.url, row.excerpt, row.author) == (
        "A new phone",
        "https://www.theverge.com/phone",
        "Short summary",
        "Sam",
    )
    assert row.published_at == datetime(2026, 10, 7, 10, 30, tzinfo=UTC)


def test_parse_invalid_feed_raises():
    with pytest.raises(technews.TechNewsError):
        technews.parse_feed(b"<html><body>oops", VERGE)


def test_clean_excerpt_cuts_on_a_word():
    text = technews.clean_excerpt("<p>" + "mot " * 100 + "</p>", length=20)
    assert text.endswith("…") and len(text) <= 21 and "  " not in text


@pytest.fixture
def sources(monkeypatch):
    calls = {"hn": 0}

    def top():
        calls["hn"] += 1
        return [item("hackernews", "hn-story", 5, score=120)]

    monkeypatch.setattr(technews, "hacker_news_top", top)
    monkeypatch.setattr(
        technews, "hacker_news_search", lambda q: [item("hackernews", f"search-{q}", 4)]
    )
    monkeypatch.setattr(
        technews, "devto_articles", lambda: [item("devto", "devto-django", 6, tags=["django"])]
    )
    monkeypatch.setattr(
        technews,
        "rss_feed",
        lambda feed: [item("rss", f"{feed.slug}-news", 7, lang=feed.lang)],
    )
    return calls


def test_news_alternates_sources_and_caches(api_client, sources):
    rows = api_client.get("/api/feed/news/").data
    # Les 5 médias RSS ne monopolisent pas le haut du fil : une source de chaque à tour de rôle.
    assert [row["source"] for row in rows[:3]] == ["rss", "devto", "hackernews"]
    assert len(rows) == 7

    api_client.get("/api/feed/news/")
    assert sources["hn"] == 1  # deuxième lecture servie par le cache


def test_single_source_is_newest_first(api_client, sources, monkeypatch):
    monkeypatch.setattr(
        technews, "devto_articles", lambda: [item("devto", "old", 1), item("devto", "new", 6)]
    )
    rows = api_client.get("/api/feed/news/", {"source": "devto"}).data
    assert [row["title"] for row in rows] == ["new", "old"]


def test_news_filters_by_source_and_lang(api_client, sources):
    rows = api_client.get("/api/feed/news/", {"source": "devto"}).data
    assert [row["title"] for row in rows] == ["devto-django"]

    rows = api_client.get("/api/feed/news/", {"lang": "fr"}).data
    assert {row["lang"] for row in rows} == {"fr"}
    assert {row["source"] for row in rows} == {"rss"}


def test_news_search_uses_algolia_and_filters_the_rest(api_client, sources):
    rows = api_client.get("/api/feed/news/", {"q": "django"}).data
    assert [row["title"] for row in rows] == ["devto-django", "search-django"]


def test_a_failing_source_is_skipped(api_client, sources, monkeypatch):
    def down():
        raise technews.TechNewsError("timeout")

    monkeypatch.setattr(technews, "devto_articles", down)
    rows = api_client.get("/api/feed/news/").data
    assert rows and "devto" not in {row["source"] for row in rows}
