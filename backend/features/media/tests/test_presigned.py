import io
from datetime import timedelta
from urllib.parse import urlsplit

import pytest
from django.utils import timezone
from PIL import Image

from features.media import services
from features.media.models import MediaAsset

pytestmark = pytest.mark.django_db(transaction=True)


def _jpeg() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (64, 48), "teal").save(buffer, format="JPEG")
    return buffer.getvalue()


def _presign(client, content: bytes, **overrides):
    payload = {
        "kind": "image",
        "mime_type": "image/jpeg",
        "size_bytes": len(content),
        "filename": "a.jpg",
        **overrides,
    }
    return client.post("/api/media/presign-upload/", payload, format="json")


def _put(client, upload: dict, content: bytes):
    parts = urlsplit(upload["url"])
    return client.generic(
        "PUT",
        f"{parts.path}?{parts.query}",
        data=content,
        content_type=upload["headers"]["Content-Type"],
    )


def test_presign_put_complete_flow(auth_client, client_for, other_user):
    content = _jpeg()
    response = _presign(auth_client, content)
    assert response.status_code == 201
    asset_id = response.data["asset_id"]
    assert response.data["upload"]["method"] == "PUT"

    # Pas encore confirmé : impossible à joindre à un post.
    asset = MediaAsset.objects.get(id=asset_id)
    assert asset.status == MediaAsset.Status.UPLOADING

    assert _put(auth_client, response.data["upload"], content).status_code == 200
    # Un autre membre ne peut pas confirmer l'envoi.
    assert client_for(other_user).post(f"/api/media/{asset_id}/complete/").status_code == 404

    done = auth_client.post(f"/api/media/{asset_id}/complete/")
    assert done.status_code == 200
    assert done.data["status"] == "processing"
    # Transcodage asynchrone (exécuté immédiatement en test).
    ready = auth_client.get(f"/api/media/{asset_id}/").data
    assert ready["status"] == "ready"
    assert ready["urls"]["small"]
    # Idempotent.
    assert auth_client.post(f"/api/media/{asset_id}/complete/").status_code == 200


def test_complete_without_upload_fails(auth_client):
    response = _presign(auth_client, _jpeg())
    done = auth_client.post(f"/api/media/{response.data['asset_id']}/complete/")
    assert done.status_code == 400
    assert done.data["error"]["code"] == "invalid_media"


def test_local_upload_rejects_bad_token(auth_client, api_client):
    response = _presign(auth_client, _jpeg())
    upload = dict(response.data["upload"])
    upload["url"] = upload["url"].split("?")[0] + "?token=forged"
    assert _put(api_client, upload, _jpeg()).status_code == 403


def test_presign_validates_type_and_size(auth_client):
    assert _presign(auth_client, b"x", mime_type="application/pdf").status_code == 400
    too_big = _presign(auth_client, b"x", size_bytes=11 * 1024 * 1024)
    assert too_big.status_code == 400


def test_purge_stale_uploads(user):
    asset, _ = services.start_upload(
        owner=user, kind="image", mime_type="image/png", size_bytes=10, filename="x.png"
    )
    assert services.purge_stale_uploads() == 0
    MediaAsset.objects.filter(id=asset.id).update(created_at=timezone.now() - timedelta(days=2))
    assert services.purge_stale_uploads() == 1
