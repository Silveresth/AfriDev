from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from features.notifications import selectors as notification_selectors
from features.profiles import services
from features.profiles.models import Profile, UserFollow

pytestmark = pytest.mark.django_db


def test_follow_unfollow_updates_counts(auth_client, user, other_user):
    response = auth_client.post("/api/profiles/kofi/follow/")
    assert response.status_code == 200
    assert response.data == {"is_following": True, "followers_count": 1, "following_count": 0}

    # Idempotent : un double clic ne compte pas deux fois.
    assert auth_client.post("/api/profiles/kofi/follow/").data["followers_count"] == 1
    assert Profile.objects.get(user=user).following_count == 1

    public = auth_client.get("/api/profiles/kofi/").data
    assert public["is_following"] is True
    assert public["followers_count"] == 1

    response = auth_client.post("/api/profiles/kofi/unfollow/")
    assert response.data == {"is_following": False, "followers_count": 0, "following_count": 0}
    assert auth_client.post("/api/profiles/kofi/unfollow/").data["followers_count"] == 0
    assert Profile.objects.get(user=user).following_count == 0


def test_cannot_follow_self(auth_client, user):
    response = auth_client.post("/api/profiles/amina/follow/")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "self_follow"
    # Garde-fou en base également.
    with pytest.raises(IntegrityError), transaction.atomic():
        UserFollow.objects.create(follower=user, followed=user)


def test_follow_requires_auth_and_notifies(
    api_client, auth_client, other_user, django_capture_on_commit_callbacks
):
    assert api_client.post("/api/profiles/kofi/follow/").status_code == 401
    with django_capture_on_commit_callbacks(execute=True):
        auth_client.post("/api/profiles/kofi/follow/")
    (notification,) = notification_selectors.list_notifications(user=other_user)
    assert notification.kind == "new_follower"
    assert notification.data == {"type": "profile", "id": "amina"}


def test_followers_and_following_lists(make_user, auth_client, client_for, user, other_user):
    third = make_user("zola")
    services.follow(follower=other_user, followed=user.profile)
    services.follow(follower=third, followed=user.profile)
    services.follow(follower=user, followed=third.profile)
    # Dates distinctes : deux abonnements créés dans la même milliseconde n'ont pas d'ordre.
    base = timezone.now()
    for offset, follower in enumerate((other_user, third)):
        UserFollow.objects.filter(follower=follower, followed=user).update(
            created_at=base + timedelta(seconds=offset)
        )

    followers = auth_client.get("/api/profiles/amina/followers/").data
    assert [row["username"] for row in followers["results"]] == ["zola", "kofi"]
    # amina suit zola, pas kofi.
    assert {row["username"]: row["is_following"] for row in followers["results"]} == {
        "zola": True,
        "kofi": False,
    }
    following = client_for(other_user).get("/api/profiles/amina/following/").data
    assert [row["username"] for row in following["results"]] == ["zola"]


def test_anonymous_profile_has_is_following_false(api_client, user):
    data = api_client.get("/api/profiles/amina/").data
    assert data["is_following"] is False
    assert data["social_links"] == {}
    assert data["banner_url"] == ""


def test_social_links_and_banner(auth_client):
    response = auth_client.patch(
        "/api/profiles/me/",
        {
            "banner_url": "https://media.afridev.dev/media/x/banner.webp",
            "social_links": {
                "github": "https://github.com/amina",
                "twitter": "https://x.com/amina",
                "portfolio": "https://amina.dev",
                "tiktok": "",
            },
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["banner_url"].endswith("banner.webp")
    assert response.data["social_links"] == {
        "github": "https://github.com/amina",
        "twitter": "https://x.com/amina",
        "portfolio": "https://amina.dev",
    }


@pytest.mark.parametrize(
    "links",
    [
        {"github": "https://evil.com/amina"},
        {"instagram": "http://instagram.com/amina"},
        {"myspace": "https://myspace.com/amina"},
    ],
)
def test_social_links_are_validated(auth_client, links):
    response = auth_client.patch("/api/profiles/me/", {"social_links": links}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_social_link"


def test_recount_follows(user, other_user):
    services.follow(follower=user, followed=other_user.profile)
    Profile.objects.update(followers_count=42, following_count=42)
    services.recount_follows()
    assert Profile.objects.get(user=other_user).followers_count == 1
    assert Profile.objects.get(user=user).following_count == 1
    assert Profile.objects.get(user=user).followers_count == 0
