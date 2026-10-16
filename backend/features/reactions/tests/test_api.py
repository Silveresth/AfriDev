import pytest

from features.projects.models import Project

pytestmark = pytest.mark.django_db


def _question(client):
    return client.post(
        "/api/qa/questions/", {"title": "Comment déployer Django ?", "body": "…"}, format="json"
    ).data


def _snippet(client, *, public=True):
    return client.post(
        "/api/snippets/",
        {"title": "Backup", "language": "bash", "content": "pg_dump", "is_public": public},
        format="json",
    ).data


def test_vote_toggle_and_home_stats(auth_client, client_for, user, other_user, make_user):
    kofi = client_for(other_user)
    question = _question(kofi)
    url = f"/api/reactions/question/{question['id']}/"

    up = auth_client.post(url, {"value": 1}, format="json")
    assert up.status_code == 200 and up.data == {"score": 1, "up": 1, "down": 0, "viewer_vote": 1}
    client_for(make_user("awa")).post(url, {"value": -1}, format="json")
    switched = auth_client.post(url, {"value": -1}, format="json").data
    assert switched["score"] == -2 and switched["viewer_vote"] == -1

    home = auth_client.get("/api/feed/home/?filter=questions").data["results"][0]
    assert home["stats"] == {
        "score": -2,
        "viewer_vote": -1,
        "comment_count": 0,
        "can_manage": False,
    }
    assert kofi.get("/api/feed/home/?filter=questions").data["results"][0]["stats"]["can_manage"]

    cleared = auth_client.post(url, {"value": 0}, format="json").data
    assert cleared["score"] == -1 and cleared["viewer_vote"] == 0


def test_vote_rejects_unknown_or_private_targets(auth_client, client_for, other_user):
    private = _snippet(client_for(other_user), public=False)
    assert (
        auth_client.post(
            f"/api/reactions/snippet/{private['id']}/", {"value": 1}, format="json"
        ).status_code
        == 404
    )
    assert (
        auth_client.post(
            f"/api/reactions/hub/{private['id']}/", {"value": 1}, format="json"
        ).status_code
        == 400
    )


def test_projects_can_be_saved_and_snippets_reported(auth_client, client_for, other_user):
    project = Project.objects.create(owner=other_user, name="Wari", description="Paiements")
    saved = auth_client.post(
        "/api/bookmarks/quick-save/",
        {"target_type": "project", "target_id": str(project.id)},
        format="json",
    )
    assert saved.status_code == 201
    assert saved.data["target"]["href"] == f"/projects/{project.id}"

    snippet = _snippet(client_for(other_user))
    report = auth_client.post(
        "/api/moderation/reports/",
        {"target_type": "snippet", "target_id": snippet["id"], "reason": "spam"},
        format="json",
    )
    assert report.status_code == 201


def test_staff_can_edit_others_content(client_for, other_user, make_user):
    question = _question(client_for(other_user))
    admin = client_for(make_user("moussa", is_staff=True))
    edited = admin.patch(
        f"/api/qa/questions/{question['id']}/", {"title": "Titre corrigé"}, format="json"
    )
    assert edited.status_code == 200 and edited.data["title"] == "Titre corrigé"

    snippet = _snippet(client_for(other_user))
    fixed = admin.patch(f"/api/snippets/{snippet['id']}/", {"title": "Sauvegarde"}, format="json")
    assert fixed.status_code == 200 and fixed.data["title"] == "Sauvegarde"
