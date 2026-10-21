import pytest

from features.feed import services, tasks
from features.feed.models import LinkPreview

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _run_on_commit(monkeypatch):
    monkeypatch.setattr("django.db.transaction.on_commit", lambda func, *a, **kw: func())


ARTICLE = {
    "url": "https://dev.to/a",
    "final_url": "https://dev.to/a",
    "status": 200,
    "kind": "article",
    "title": "Déployer Django sur un VPS",
    "description": "Pas à pas.",
    "image": "https://dev.to/cover.png",
    "site_name": "DEV Community",
    "text": "Un long article. " * 100,
    "words": 660,
}


def test_link_post_gets_card_and_ai_summary(auth_client, monkeypatch, fake_llm):
    monkeypatch.setattr("core.links.page", lambda url: ARTICLE)
    fake_llm.when("résumes une ressource", {"points": ["Point 1", "Point 2", "Point 3", "Point 4"]})

    created = auth_client.post(
        "/api/feed/",
        {"kind": "text", "title": "Super article", "body": "", "link_url": "https://dev.to/a"},
        format="json",
    )
    assert created.status_code == 201
    post = auth_client.get(f"/api/feed/{created.data['id']}/").data
    card = post["link_preview"]
    assert card["status"] == "ready"
    assert card["title"] == "Déployer Django sur un VPS"
    assert card["image_url"] == "https://dev.to/cover.png"
    assert card["domain"] == "dev.to"
    assert card["reading_minutes"] == 3
    assert card["summary"] == ["Point 1", "Point 2", "Point 3"]


def test_unreachable_link_is_marked_failed(monkeypatch):
    from core import links

    def unreachable(url):
        raise links.UnsafeURL("Adresse non publique refusée.")

    monkeypatch.setattr("core.links.page", unreachable)
    LinkPreview.objects.create(url="https://interne.example/")
    tasks.fetch_link_preview("https://interne.example/")
    assert LinkPreview.objects.get(url="https://interne.example/").status == "failed"


def test_insecure_image_is_dropped():
    LinkPreview.objects.create(url="https://exemple.org/")
    services.store_link_preview(
        url="https://exemple.org/",
        data={**ARTICLE, "image": "http://exemple.org/i.png", "words": 10},
    )
    preview = LinkPreview.objects.get(url="https://exemple.org/")
    assert preview.image_url == "" and preview.reading_minutes is None


def test_page_text_extraction():
    from core.links import _page_text

    html = (
        "<html><script>var x=1</script><nav><p>Menu menu menu menu menu menu menu menu</p></nav>"
        "<h1>Titre</h1><p>Un paragraphe suffisamment long pour être gardé dans le texte.</p>"
        "<p>Court</p></html>"
    )
    text, words = _page_text(html)
    assert text == "Titre\nUn paragraphe suffisamment long pour être gardé dans le texte."
    assert "Menu" not in text and words == 11
