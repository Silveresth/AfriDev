import pytest

from features.onboarding_agent import selectors as guide_selectors
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


def test_accepted_candidate_gets_welcome_page_and_guide(
    auth_client, client_for, user, other_user, make_user, monkeypatch
):
    # Ni GitHub ni l'IA pendant le test : les tâches sont neutralisées par leur chemin.
    monkeypatch.setattr(
        "features.projects.tasks.sync_project_repo.delay", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(
        "features.onboarding_agent.tasks.ai_build_onboarding_guide.delay",
        lambda *args, **kwargs: None,
    )
    project = project_services.create_project(
        owner=user, name="AfriPay", tags=["django"], repo_url="https://github.com/afridev/afripay"
    )
    project_services.store_repo_sync(
        project_id=project.id,
        repo={"stars": 3},
        issues=[
            {"number": 1, "title": "Refactor", "url": "https://github.com/x/1"},
            {
                "number": 2,
                "title": "Fix typo",
                "url": "https://github.com/x/2",
                "labels": ["good first issue"],
            },
        ],
    )

    candidate = client_for(other_user)
    application = candidate.post(
        f"/api/matchmaking/projects/{project.id}/apply/", {}, format="json"
    )
    url = f"/api/matchmaking/applications/{application.data['id']}/welcome/"
    assert candidate.get(url).status_code == 404  # pas encore acceptée

    auth_client.post(
        f"/api/matchmaking/applications/{application.data['id']}/answer/",
        {"accept": True},
        format="json",
    )
    guide = guide_selectors.latest_project_guide(project_id=project.id)
    assert guide.requested_by_id == other_user.id

    welcome = candidate.get(url).data
    assert welcome["viewer_role"] == "candidate"
    assert welcome["owner"]["username"] == "amina"
    assert [m["username"] for m in welcome["team"]] == ["kofi"]
    assert welcome["guide"]["id"] == str(guide.id)
    assert [i["number"] for i in welcome["issues"]] == [2, 1]
    assert welcome["issues"][0]["good_first"] is True
    assert auth_client.get(url).data["viewer_role"] == "owner"
    assert client_for(make_user("awa")).get(url).status_code == 404
