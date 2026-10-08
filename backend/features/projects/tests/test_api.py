import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def test_projects_api(api_client, auth_client, client_for, other_user):
    created = auth_client.post(
        "/api/projects/", {"name": "AfriPay", "tags": ["Django", "React"]}, format="json"
    )
    assert created.status_code == 201
    project_id = created.data["id"]

    listing = api_client.get("/api/projects/", {"tag": "django"})
    assert [p["id"] for p in listing.data["results"]] == [project_id]

    forbidden = client_for(other_user).patch(
        f"/api/projects/{project_id}/", {"name": "Volé"}, format="json"
    )
    assert forbidden.status_code == 403
    updated = auth_client.patch(
        f"/api/projects/{project_id}/", {"is_recruiting": False}, format="json"
    )
    assert updated.data["is_recruiting"] is False

    no_repo = auth_client.post(f"/api/projects/{project_id}/sync/")
    assert no_repo.status_code == 400 and no_repo.data["error"]["code"] == "no_repo"
