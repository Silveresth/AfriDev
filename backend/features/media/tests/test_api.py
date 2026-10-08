import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

pytestmark = pytest.mark.django_db(transaction=True)


def test_upload_get_and_delete(auth_client, client_for, other_user):
    buffer = io.BytesIO()
    Image.new("RGB", (100, 100), "orange").save(buffer, format="JPEG")
    upload = SimpleUploadedFile("a.jpg", buffer.getvalue(), content_type="image/jpeg")

    response = auth_client.post(
        "/api/media/", {"kind": "image", "file": upload}, format="multipart"
    )
    assert response.status_code == 201
    asset_id = response.data["id"]

    assert auth_client.get(f"/api/media/{asset_id}/").data["status"] == "ready"
    # Seul le propriétaire peut supprimer.
    assert client_for(other_user).delete(f"/api/media/{asset_id}/").status_code == 404
    assert auth_client.delete(f"/api/media/{asset_id}/").status_code == 204
    assert auth_client.get(f"/api/media/{asset_id}/").status_code == 404
