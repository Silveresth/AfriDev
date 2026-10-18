import pytest

from core.mentions import extract_usernames

pytestmark = pytest.mark.django_db


def test_extract_usernames():
    text = "Merci @Kofi et @awa_dev ! écris à contact@afridev.dev, cc @kofi"
    assert extract_usernames(text) == ["kofi", "awa_dev"]
    assert extract_usernames("pas de mention") == []


def test_people_search(api_client, client_for, user, make_user):
    make_user("kofi_dev", display_name="Kofi Mensah")
    make_user("akofi", display_name="Ama")
    results = api_client.get("/api/profiles/search/", {"q": "kofi"}).data
    assert [row["username"] for row in results][:2] == ["kofi_dev", "akofi"]
    by_name = api_client.get("/api/profiles/search/", {"q": "@mensah"}).data
    assert by_name[0]["username"] == "kofi_dev"
    assert api_client.get("/api/profiles/search/", {"q": ""}).data == []


def test_mention_in_post_comment_notifies(
    auth_client, client_for, other_user, make_user, django_capture_on_commit_callbacks
):
    awa = make_user("awa")
    with django_capture_on_commit_callbacks(execute=True):
        post = auth_client.post("/api/feed/", {"body": "Hello @awa"}, format="json")
    assert post.status_code == 201
    with django_capture_on_commit_callbacks(execute=True):
        comment = client_for(other_user).post(
            f"/api/discussions/posts/{post.data['id']}/comments/",
            {"body": "Je pense que @Awa et @amina ont la réponse"},
            format="json",
        )
    assert comment.status_code == 201

    awa_notifs = client_for(awa).get("/api/notifications/").data["results"]
    assert [n["kind"] for n in awa_notifs].count("mention") == 2  # le post et le commentaire
    # L'autrice du post reçoit « nouveau commentaire », pas une seconde alerte de mention.
    amina_kinds = [n["kind"] for n in auth_client.get("/api/notifications/").data["results"]]
    assert "mention" not in amina_kinds and "new_comment" in amina_kinds
