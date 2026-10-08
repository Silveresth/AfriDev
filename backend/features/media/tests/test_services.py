import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from features.media import selectors, services
from features.media.models import MediaAsset
from features.media.thumbhash import rgba_to_thumbhash

pytestmark = pytest.mark.django_db(transaction=True)


def _png(width=640, height=360, color=(30, 120, 200)) -> SimpleUploadedFile:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="PNG")
    return SimpleUploadedFile("photo.png", buffer.getvalue(), content_type="image/png")


def test_image_upload_produces_webp_variants_and_thumbhash(user):
    asset = services.upload_media(owner=user, kind="image", uploaded_file=_png())
    asset.refresh_from_db()

    assert asset.status == MediaAsset.Status.READY
    assert asset.width == 640 and asset.height == 360
    assert asset.variants["small"].endswith(".webp")
    assert asset.variants["large"].endswith(".webp")
    assert asset.thumbhash

    described = selectors.describe(asset)
    assert described["urls"]["small"]


def test_rejects_wrong_type(user):
    fake = SimpleUploadedFile("virus.exe", b"MZ...", content_type="application/x-msdownload")
    with pytest.raises(services.InvalidMediaError):
        services.upload_media(owner=user, kind="image", uploaded_file=fake)


def test_audio_without_ffmpeg_is_served_as_is(user):
    voice = SimpleUploadedFile("voice.m4a", b"\x00" * 2048, content_type="audio/mp4")
    asset = services.upload_media(owner=user, kind="audio", uploaded_file=voice)
    asset.refresh_from_db()
    assert asset.status == MediaAsset.Status.READY
    assert asset.variants == {}


def test_thumbhash_is_compact_and_deterministic():
    image = Image.new("RGBA", (32, 24), (200, 40, 40, 255))
    raw = image.tobytes()
    first = rgba_to_thumbhash(32, 24, raw)
    assert first == rgba_to_thumbhash(32, 24, raw)
    assert 5 <= len(first) <= 30
