import pytest

from features.profiles import selectors as profile_selectors
from features.profiles import services as profile_services
from features.projects import services as project_services

pytestmark = pytest.mark.django_db(transaction=True)


def test_matchmaking_api(auth_client, client_for, user, other_user):
    profile = profile_selectors.get_profile_for_user(user_id=other_user.id)
    profile_services.update_profile(profile=profile, stack=["python"])
    project = project_services.create_project(owner=user, name="DataLab", tags=["python"])

    other = client_for(other_user)
    recommended = other.get("/api/matchmaking/projects/")
    assert recommended.data[0]["project"]["name"] == "DataLab"
    assert recommended.data[0]["matched"] == ["python"]

    applied = other.post(f"/api/matchmaking/projects/{project.id}/apply/", {}, format="json")
    assert applied.status_code == 201

    # Réservé au porteur du projet.
    assert other.get(f"/api/matchmaking/projects/{project.id}/candidates/").status_code == 403
    applications = auth_client.get(f"/api/matchmaking/projects/{project.id}/applications/")
    assert len(applications.data) == 1
