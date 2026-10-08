import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def _post(client, title="Astuce Django"):
    return client.post("/api/feed/", {"title": title, "body": "…"}, format="json").data


def test_collections_crud_and_items(auth_client, client_for, other_user):
    created = auth_client.post(
        "/api/bookmarks/collections/",
        {"name": "Mes snippets Django", "description": "À relire"},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["is_private"] is True and created.data["item_count"] == 0
    collection_id = created.data["id"]

    duplicate = auth_client.post(
        "/api/bookmarks/collections/", {"name": "Mes snippets Django"}, format="json"
    )
    assert duplicate.status_code == 409

    post = _post(client_for(other_user))
    added = auth_client.post(
        f"/api/bookmarks/collections/{collection_id}/items/",
        {"target_type": "post", "target_id": post["id"]},
        format="json",
    )
    assert added.status_code == 201
    assert added.data["target"]["title"] == "Astuce Django"
    assert added.data["target"]["href"] == f"/feed/{post['id']}"
    assert added.data["target"]["author"]["username"] == "kofi"
    again = auth_client.post(
        f"/api/bookmarks/collections/{collection_id}/items/",
        {"target_type": "post", "target_id": post["id"]},
        format="json",
    )
    assert again.data["id"] == added.data["id"]  # idempotent

    listing = auth_client.get("/api/bookmarks/collections/")
    assert listing.data[0]["item_count"] == 1
    saved = auth_client.get("/api/bookmarks/saved/").json()
    assert saved == [
        {
            "target_type": "post",
            "target_id": str(post["id"]),
            "collection_ids": [str(listing.data[0]["id"])],
        }
    ]

    items = auth_client.get(f"/api/bookmarks/collections/{collection_id}/items/")
    assert len(items.data["results"]) == 1

    # Collection privée : invisible pour les autres.
    kofi = client_for(other_user)
    assert kofi.get(f"/api/bookmarks/collections/{collection_id}/items/").status_code == 404
    auth_client.patch(
        f"/api/bookmarks/collections/{collection_id}/", {"is_private": False}, format="json"
    )
    assert kofi.get(f"/api/bookmarks/collections/{collection_id}/items/").status_code == 200
    assert (
        kofi.delete(f"/api/bookmarks/collections/{collection_id}/").status_code == 404
    )  # lecture seule pour les autres

    removed = auth_client.delete(
        f"/api/bookmarks/collections/{collection_id}/items/?target_type=post&target_id={post['id']}"
    )
    assert removed.status_code == 204
    assert auth_client.get("/api/bookmarks/saved/").data == []

    assert auth_client.delete(f"/api/bookmarks/collections/{collection_id}/").status_code == 204
    assert auth_client.get("/api/bookmarks/collections/").data == []


def test_deleted_content_and_private_snippets(auth_client, client_for, other_user):
    kofi = client_for(other_user)
    private = kofi.post(
        "/api/snippets/",
        {"title": "Secret", "language": "bash", "content": "echo hi"},
        format="json",
    ).data
    refused = auth_client.post(
        "/api/bookmarks/quick-save/",
        {"target_type": "snippet", "target_id": private["id"]},
        format="json",
    )
    assert refused.status_code == 404

    post = _post(kofi, "Bientôt supprimé")
    saved = auth_client.post(
        "/api/bookmarks/quick-save/",
        {"target_type": "post", "target_id": post["id"]},
        format="json",
    )
    assert saved.status_code == 201
    collections = auth_client.get("/api/bookmarks/collections/").data
    assert [c["name"] for c in collections] == ["Favoris"]

    kofi.delete(f"/api/feed/{post['id']}/")
    items = auth_client.get(f"/api/bookmarks/collections/{collections[0]['id']}/items/")
    assert items.data["results"][0]["target"] is None
