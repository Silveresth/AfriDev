import io

import pytest
from PIL import Image

from features.media.models import MediaAsset
from integrations import cloudinary
from integrations.cloudinary import client as cloudinary_client

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def cloud(settings, monkeypatch):
    settings.CLOUDINARY_CLOUD_NAME = "demo"
    settings.CLOUDINARY_API_KEY = "123456789012345"
    settings.CLOUDINARY_API_SECRET = "secret"
    state = {"resource": None, "destroyed": []}

    def fake_resource(*, public_id, resource_type):
        return state["resource"]

    def fake_destroy(*, public_id, resource_type):
        state["destroyed"].append((public_id, resource_type))

    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), "teal").save(buffer, format="PNG")
    monkeypatch.setattr(cloudinary_client, "resource", fake_resource)
    monkeypatch.setattr(cloudinary_client, "destroy", fake_destroy)
    monkeypatch.setattr(cloudinary_client, "download", lambda url, max_bytes: buffer.getvalue())
    # Les modules importent le paquet : on remplace aussi ses références.
    monkeypatch.setattr(cloudinary, "resource", fake_resource)
    monkeypatch.setattr(cloudinary, "destroy", fake_destroy)
    monkeypatch.setattr(cloudinary, "download", lambda url, max_bytes: buffer.getvalue())
    return state


def test_signature_matches_cloudinary_documentation(settings):
    # Exemple officiel : « Generating authentication signatures » (documentation Cloudinary).
    settings.CLOUDINARY_API_SECRET = "abcd"
    params = {
        "eager": "w_400,h_300,c_pad|w_260,h_200,c_crop",
        "public_id": "sample_image",
        "timestamp": "1315060510",
    }
    assert cloudinary.sign(params) == "bfd09f95f331f558cbd1320e67aa8d488770583e"


def test_direct_upload_to_cloudinary(auth_client, user, cloud):
    presign = auth_client.post(
        "/api/media/presign-upload/",
        {"kind": "image", "mime_type": "image/png", "size_bytes": 2048, "filename": "a.png"},
        format="json",
    )
    assert presign.status_code == 201
    upload = presign.data["upload"]
    assert upload["method"] == "POST"
    assert upload["url"] == "https://api.cloudinary.com/v1_1/demo/image/upload"
    assert upload["file_field"] == "file"
    asset_id = presign.data["asset_id"]
    # Emplacement imposé et signé : le dossier du membre.
    assert upload["fields"]["public_id"] == f"afridev/media/{user.id}/{asset_id}"
    assert upload["fields"]["signature"] == cloudinary.sign(
        {k: v for k, v in upload["fields"].items() if k not in ("api_key", "signature")}
    )

    # Rien reçu par Cloudinary : la confirmation échoue.
    assert auth_client.post(f"/api/media/{asset_id}/complete/").status_code == 400

    cloud["resource"] = cloudinary.ResourceInfo(
        bytes=2048,
        format="png",
        secure_url="https://res.cloudinary.com/demo/image/upload/v1/x.png",
        width=40,
        height=30,
        duration=None,
    )
    done = auth_client.post(f"/api/media/{asset_id}/complete/")
    assert done.status_code == 200
    ready = auth_client.get(f"/api/media/{asset_id}/").data
    assert ready["status"] == "ready"
    assert ready["original_url"] == "https://res.cloudinary.com/demo/image/upload/v1/x.png"
    assert ready["urls"]["small"].startswith(
        "https://res.cloudinary.com/demo/image/upload/c_limit,w_480"
    )
    assert ready["width"] == 40 and ready["thumbhash"]


def test_video_variants_and_oversized_upload(auth_client, cloud):
    presign = auth_client.post(
        "/api/media/presign-upload/",
        {"kind": "video", "mime_type": "video/mp4", "size_bytes": 1000, "filename": "v.mp4"},
        format="json",
    ).data
    assert presign["upload"]["url"].endswith("/video/upload")
    assert presign["upload"]["fields"]["eager"] == "sp_auto/m3u8"

    cloud["resource"] = cloudinary.ResourceInfo(
        bytes=200 * 1024 * 1024,
        format="mp4",
        secure_url="https://x",
        width=720,
        height=1280,
        duration=12.0,
    )
    too_big = auth_client.post(f"/api/media/{presign['asset_id']}/complete/")
    assert too_big.status_code == 400
    assert cloud["destroyed"] and MediaAsset.objects.get(id=presign["asset_id"]).status == "failed"


def test_multipart_upload_refused_with_cloudinary(auth_client, cloud):
    from django.core.files.uploadedfile import SimpleUploadedFile

    upload = SimpleUploadedFile("a.png", b"x" * 10, content_type="image/png")
    response = auth_client.post(
        "/api/media/", {"kind": "image", "file": upload}, format="multipart"
    )
    assert response.status_code == 400
