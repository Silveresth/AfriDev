import pytest

from core.exceptions import DomainError
from features.feed import services

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", ""),
        ("  ", ""),
        ("github.com/afridev", "https://github.com/afridev"),
        ("https://dev.to/article?x=1", "https://dev.to/article?x=1"),
    ],
)
def test_clean_link_accepts(raw, expected):
    assert services.clean_link(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["javascript:alert(1)", "ftp://exemple.com/x", "https://user:pass@exemple.com", "pas un lien"],
)
def test_clean_link_rejects(raw):
    with pytest.raises(DomainError):
        services.clean_link(raw)


def test_create_and_edit_post_link(auth_client):
    created = auth_client.post(
        "/api/feed/",
        {"kind": "text", "title": "Un bon article", "body": "", "link_url": "dev.to/article"},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["link_url"] == "https://dev.to/article"

    url = f"/api/feed/{created.data['id']}/"
    removed = auth_client.patch(url, {"link_url": ""}, format="json")
    assert removed.data["link_url"] == ""

    invalid = auth_client.patch(url, {"link_url": "javascript:alert(1)"}, format="json")
    assert invalid.status_code == 400
