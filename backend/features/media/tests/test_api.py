import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from features.media.models import MediaAsset

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.mark.parametrize(
    "filename", ["piege.html", "piege.svg", "piege.php", "piege", "a.jpg.html"]
)
def test_stored_extension_never_comes_from_the_client_filename(auth_client, filename):
    """XSS stockée : un .html déclaré image/png serait servi en page sous /media/ (même domaine)."""
    response = auth_client.post(
        "/api/media/presign-upload/",
        {"kind": "image", "mime_type": "image/png", "size_bytes": 1200, "filename": filename},
        format="json",
    )
    assert response.status_code == 201
    path = MediaAsset.objects.get(id=response.data["asset_id"]).original_path
    assert path.endswith("/original.png")


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
    assert MediaAsset.objects.get(id=asset_id).original_path.endswith("/original.jpg")
    # Seul le propriétaire peut supprimer.
    assert client_for(other_user).delete(f"/api/media/{asset_id}/").status_code == 404
    assert auth_client.delete(f"/api/media/{asset_id}/").status_code == 204
    assert auth_client.get(f"/api/media/{asset_id}/").status_code == 404
