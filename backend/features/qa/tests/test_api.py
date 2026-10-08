import pytest

pytestmark = pytest.mark.django_db(transaction=True)

TITLE = "Comment déployer Django sur un VPS ?"


def test_question_lifecycle(api_client, auth_client, client_for, other_user):
    created = auth_client.post(
        "/api/qa/questions/",
        {"title": TITLE, "body": "Avec Nginx.", "tags": ["Django"]},
        format="json",
    )
    assert created.status_code == 201
    question_id = created.data["id"]

    # Page publique (SEO) lisible sans compte.
    public = api_client.get(f"/api/qa/questions/{question_id}/")
    assert public.status_code == 200
    assert public.data["tags"] == ["django"]

    other = client_for(other_user)
    answer = other.post(
        f"/api/qa/questions/{question_id}/answers/", {"body": "Gunicorn + Nginx."}, format="json"
    )
    assert answer.status_code == 201

    assert other.post(f"/api/qa/answers/{answer.data['id']}/accept/").status_code == 403
    accepted = auth_client.post(f"/api/qa/answers/{answer.data['id']}/accept/")
    assert accepted.data["is_accepted"] is True

    resolved = api_client.get("/api/qa/questions/", {"resolved": "true"})
    assert [q["id"] for q in resolved.data["results"]] == [question_id]


def test_rephrase_returns_job(auth_client, fake_llm):
    fake_llm.when("reformuler", {"title": "Titre amélioré pour la question", "body": "Corps"})
    response = auth_client.post(
        "/api/qa/rephrase/", {"title": "aide", "body": "bug"}, format="json"
    )
    assert response.status_code == 202
    job = auth_client.get(f"/api/jobs/{response.data['job_id']}/")
    assert job.data["status"] == "done"
    assert job.data["result"]["title"] == "Titre amélioré pour la question"
