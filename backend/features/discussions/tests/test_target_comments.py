import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def project(other_user):
    from features.projects import services

    return services.create_project(owner=other_user, name="AfriPay", description="Paiements")


@pytest.fixture
def job(other_user):
    from features.jobs_events import services

    return services.create_job(
        author=other_user,
        title="Dev Django",
        company="Kora",
        contract_type="cdi",
        description="Backend",
        apply_url="https://kora.example/jobs",
        is_remote=True,
    )


@pytest.mark.parametrize("kind", ["project", "job"])
def test_comment_project_and_job(
    kind,
    request,
    auth_client,
    client_for,
    other_user,
    api_client,
    django_capture_on_commit_callbacks,
):
    target = request.getfixturevalue(kind)
    url = f"/api/discussions/targets/{kind}/{target.id}/comments/"

    assert api_client.post(url, {"body": "Hello"}, format="json").status_code in (401, 403)
    with django_capture_on_commit_callbacks(execute=True):
        created = auth_client.post(url, {"body": "Super initiative !"}, format="json")
    assert created.status_code == 201
    reply = client_for(other_user).post(
        url, {"body": "Merci", "parent_id": created.data["id"]}, format="json"
    )
    assert reply.status_code == 201

    listed = api_client.get(url).data["results"]
    assert [c["body"] for c in listed] == ["Super initiative !", "Merci"]

    # Le propriétaire est notifié du commentaire.
    notifications = client_for(other_user).get("/api/notifications/").data["results"]
    assert any(n["data"].get("type") == kind for n in notifications)

    # Le propriétaire du contenu peut retirer un commentaire ; un tiers non.
    comment_url = f"/api/discussions/target-comments/{created.data['id']}/"
    assert client_for(other_user).delete(comment_url).status_code == 204
    assert len(api_client.get(url).data["results"]) == 1


def test_unknown_target(auth_client, project):
    url = f"/api/discussions/targets/hub/{project.id}/comments/"
    assert auth_client.post(url, {"body": "x"}, format="json").status_code == 404


def test_job_vote_save_and_home_stats(auth_client, job):
    voted = auth_client.post(f"/api/reactions/job/{job.id}/", {"value": 1}, format="json")
    assert voted.status_code == 200 and voted.data["score"] == 1
    assert auth_client.get(f"/api/reactions/job/{job.id}/").data["viewer_vote"] == 1

    saved = auth_client.post(
        "/api/bookmarks/quick-save/",
        {"target_type": "job", "target_id": str(job.id)},
        format="json",
    )
    assert saved.status_code in (200, 201)
    collection = auth_client.get("/api/bookmarks/collections/").data[0]
    items = auth_client.get(f"/api/bookmarks/collections/{collection['id']}/items/").data
    assert items["results"][0]["target"]["href"] == f"/jobs/{job.id}"

    auth_client.post(
        f"/api/discussions/targets/job/{job.id}/comments/", {"body": "Remote ?"}, format="json"
    )
    home = auth_client.get("/api/feed/home/?filter=jobs").data["results"]
    card = next(item for item in home if str(item["id"]) == str(job.id))
    assert card["stats"]["score"] == 1 and card["stats"]["comment_count"] == 1
    assert card["card"]["url"] == f"/jobs/{job.id}"


def test_report_job(auth_client, job):
    response = auth_client.post(
        "/api/moderation/reports/",
        {"target_type": "job", "target_id": str(job.id), "reason": "scam", "details": ""},
        format="json",
    )
    assert response.status_code == 201
