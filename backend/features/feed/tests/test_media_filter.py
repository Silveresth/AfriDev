import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from features.feed import services
from features.media import services as media_services

pytestmark = pytest.mark.django_db(transaction=True)


def _video(owner):
    clip = SimpleUploadedFile("demo.mp4", b"\x00" * 1024, content_type="video/mp4")
    # Sans ffmpeg (tests), la vidéo est prête aussitôt et servie telle quelle.
    return media_services.upload_media(owner=owner, kind="video", uploaded_file=clip)


def test_feed_media_filter_returns_author_videos(api_client, user, other_user):
    video = _video(user)
    with_video = services.create_post(author=user, kind="short", body="Démo", media_id=video.id)
    services.create_post(author=user, body="Texte seul")
    services.create_post(author=other_user, body="Autre membre")

    response = api_client.get(f"/api/feed/?author={user.id}&media=video&sort=new")
    assert [str(post["id"]) for post in response.data["results"]] == [str(with_video.id)]
    assert response.data["results"][0]["media"]["kind"] == "video"

    # Filtre inconnu ignoré : tous les posts de l'auteur.
    everything = api_client.get(f"/api/feed/?author={user.id}&media=gif").data["results"]
    assert len(everything) == 2
