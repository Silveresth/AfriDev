from datetime import timedelta

import pytest
from django.utils import timezone

pytestmark = pytest.mark.django_db(transaction=True)

JOB = {
    "title": "Développeur·se Django",
    "company": "KwikKassa",
    "location": "Dakar",
    "country": "Sénégal",
    "contract_type": "cdi",
    "description": "Paiements mobile money à grande échelle.",
    "apply_url": "https://kwikkassa.example/jobs/1",
    "stack": ["Django", "PostgreSQL"],
}


def test_jobs_crud_and_filters(api_client, auth_client, client_for, other_user):
    created = auth_client.post("/api/job-board/", JOB, format="json")
    assert created.status_code == 201, created.data
    assert created.data["stack"] == ["django", "postgresql"]
    remote = auth_client.post(
        "/api/job-board/",
        {
            **JOB,
            "title": "Dev Flutter",
            "is_remote": True,
            "location": "",
            "country": "",
            "contract_type": "freelance",
            "stack": ["flutter"],
        },
        format="json",
    )
    assert remote.status_code == 201

    def titles(**params):
        return [j["title"] for j in api_client.get("/api/job-board/", params).data["results"]]

    assert titles(country="sénégal") == ["Développeur·se Django"]
    assert titles(tech="flutter") == ["Dev Flutter"]
    assert titles(remote="true") == ["Dev Flutter"]
    assert titles(contract="cdi") == ["Développeur·se Django"]
    assert titles(q="kwik") == ["Dev Flutter", "Développeur·se Django"]

    facets = api_client.get("/api/job-board/facets/").data
    assert facets["countries"] == [{"value": "Sénégal", "count": 1}]
    assert {"value": "django", "count": 1} in facets["technologies"]

    job_id = created.data["id"]
    assert (
        client_for(other_user)
        .patch(f"/api/job-board/{job_id}/", {"title": "Volé"}, format="json")
        .status_code
        == 403
    )
    closed = auth_client.patch(f"/api/job-board/{job_id}/", {"is_active": False}, format="json")
    assert closed.data["is_active"] is False
    assert titles(country="Sénégal") == []  # une offre pourvue sort du Job Board

    bad_link = auth_client.post(
        "/api/job-board/", {**JOB, "apply_url": "javascript:alert(1)"}, format="json"
    )
    assert bad_link.status_code == 400 and bad_link.data["error"]["code"] == "invalid_link"
    nowhere = auth_client.post(
        "/api/job-board/", {**JOB, "location": "", "country": "", "is_remote": False}, format="json"
    )
    assert nowhere.status_code == 400


def test_events_upcoming_and_past(api_client, auth_client):
    soon = timezone.now() + timedelta(days=3)
    created = auth_client.post(
        "/api/events/",
        {
            "title": "Hackathon Mobile Money",
            "kind": "hackathon",
            "starts_at": soon.isoformat(),
            "ends_at": (soon + timedelta(days=1)).isoformat(),
            "location": "Abidjan",
            "country": "Côte d'Ivoire",
            "organizer": "AfriDev",
            "registration_url": "https://example.com/hack",
            "tags": ["fintech"],
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    online = auth_client.post(
        "/api/events/",
        {
            "title": "Webinar Flutter",
            "kind": "webinar",
            "starts_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "is_online": True,
            "organizer": "GDG Lomé",
        },
        format="json",
    )
    assert online.status_code == 201
    past = auth_client.post(
        "/api/events/",
        {
            "title": "Meetup passé",
            "kind": "meetup",
            "starts_at": (timezone.now() - timedelta(days=10)).isoformat(),
            "location": "Lomé",
            "organizer": "Club",
        },
        format="json",
    )
    assert past.status_code == 201

    upcoming = [e["title"] for e in api_client.get("/api/events/").data["results"]]
    assert upcoming == ["Webinar Flutter", "Hackathon Mobile Money"]  # le plus proche d'abord
    assert [
        e["title"] for e in api_client.get("/api/events/", {"online": "true"}).data["results"]
    ] == ["Webinar Flutter"]
    assert [
        e["title"] for e in api_client.get("/api/events/", {"past": "true"}).data["results"]
    ] == ["Meetup passé"]

    no_place = auth_client.post(
        "/api/events/",
        {
            "title": "Sans lieu",
            "kind": "meetup",
            "starts_at": soon.isoformat(),
            "organizer": "X",
        },
        format="json",
    )
    assert no_place.status_code == 400
    reversed_dates = auth_client.patch(
        f"/api/events/{created.data['id']}/",
        {"ends_at": (soon - timedelta(days=1)).isoformat()},
        format="json",
    )
    assert reversed_dates.status_code == 400
