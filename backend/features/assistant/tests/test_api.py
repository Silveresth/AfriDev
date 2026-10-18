import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _run_on_commit(monkeypatch):
    """Les tâches IA partent après la transaction : exécutées tout de suite dans ces tests."""
    monkeypatch.setattr("django.db.transaction.on_commit", lambda func, *a, **kw: func())


def _result(client, response):
    assert response.status_code == 202, response.data
    job = client.get(f"/api/jobs/{response.data['job_id']}/").data
    assert job["status"] == "done", job
    return job["result"]


@pytest.fixture
def job_offer(other_user):
    from features.jobs_events import services

    return services.create_job(
        author=other_user,
        title="Dev Django",
        company="Kora",
        contract_type="cdi",
        description="API Django REST et PostgreSQL",
        apply_url="https://kora.example/jobs",
        is_remote=True,
        stack=["django", "postgresql"],
    )


def test_job_match(auth_client, job_offer, fake_llm):
    fake_llm.when(
        "conseiller carrière",
        {
            "score": 140,
            "verdict": "Bonne base",
            "strengths": ["Python"],
            "gaps": ["PostgreSQL"],
            "plan": [{"step": "Suivre le tutoriel", "resource": "docs postgresql"}, "x"],
        },
    )
    result = _result(
        auth_client,
        auth_client.post("/api/assistant/job-match/", {"job_id": str(job_offer.id)}, format="json"),
    )
    assert result["score"] == 100  # borné
    assert result["plan"] == [{"step": "Suivre le tutoriel", "resource": "docs postgresql"}]


def test_code_review(auth_client, fake_llm):
    fake_llm.when(
        "relecteur de code",
        {
            "summary": "Injection SQL.",
            "score": 40,
            "issues": [
                {
                    "severity": "critique",
                    "category": "securite",
                    "line": 2,
                    "title": "Injection",
                    "detail": "f-string",
                    "suggestion": "params",
                },
                {
                    "severity": "énorme",
                    "category": "?",
                    "title": "Autre",
                    "detail": "",
                    "suggestion": "",
                },
            ],
        },
    )
    code = "def find(name):\n    return db.execute(f'SELECT * FROM u WHERE n={name}')"
    result = _result(
        auth_client,
        auth_client.post(
            "/api/assistant/code-review/", {"code": code, "language": "python"}, format="json"
        ),
    )
    assert result["issues"][0]["line"] == 2
    assert result["issues"][1]["severity"] == "mineur"  # valeur inconnue normalisée
    too_short = auth_client.post("/api/assistant/code-review/", {"code": "x"}, format="json")
    assert too_short.status_code == 400


def test_chat_replies_and_scam_warning(
    auth_client, client_for, other_user, fake_llm, django_capture_on_commit_callbacks
):
    fake_llm.when("arnaques par", {"scam": True, "confidence": 0.9, "warning": "Ne payez rien."})
    fake_llm.when("réponses rapides", {"replies": ["Oui !", "Quand ?", "Pas dispo", "trop"]})
    conversation = auth_client.post(
        "/api/messages/conversations/", {"username": "kofi"}, format="json"
    ).data
    url = f"/api/messages/conversations/{conversation['id']}/messages/"
    with django_capture_on_commit_callbacks(execute=True):
        auth_client.post(
            url,
            {"body": "Payez 20 000 FCFA de frais de dossier par mobile money pour le poste"},
            format="json",
        )

    kofi = client_for(other_user)
    received = kofi.get(url).data["results"][0]
    assert received["risk_note"] == "Ne payez rien."
    assert auth_client.get(url).data["results"][0]["risk_note"] == ""  # pas chez l'expéditeur

    result = _result(
        kofi,
        kofi.post(
            "/api/assistant/chat-replies/", {"conversation_id": conversation["id"]}, format="json"
        ),
    )
    assert result["replies"] == ["Oui !", "Quand ?", "Pas dispo"]


def test_digest(auth_client, job_offer, user, fake_llm):
    user.profile.stack = ["django"]
    user.profile.save()
    fake_llm.when(
        "résumé du matin",
        {
            "headline": "Belle journée",
            "items": [{"emoji": "💼", "text": "Une offre Django", "url": f"/jobs/{job_offer.id}"}],
        },
    )
    first = auth_client.get("/api/assistant/digest/")
    assert first.status_code == 202
    again = auth_client.get("/api/assistant/digest/")
    assert again.status_code == 200
    assert again.data["digest"]["items"][0]["url"] == f"/jobs/{job_offer.id}"


def test_team_and_invite(
    auth_client, client_for, user, make_user, fake_llm, django_capture_on_commit_callbacks
):
    from features.projects import services as project_services

    project = project_services.create_project(
        owner=user, name="AfriPay", description="Paiements", tags=["django", "react"]
    )
    awa = make_user("awa")
    awa.profile.stack = ["react", "typescript"]
    awa.profile.open_to_work = True
    awa.profile.save()
    fake_llm.when(
        "constituer son équipe",
        {
            "candidates": [
                {"username": "awa", "fit": 88, "role": "Front", "reason": "React"},
                {"username": "inconnu"},
            ],
            "invitation": "Salut {prenom}",
        },
    )
    result = _result(
        auth_client,
        auth_client.post("/api/assistant/team/", {"project_id": str(project.id)}, format="json"),
    )
    assert [c["username"] for c in result["candidates"]] == ["awa"]

    # Seul le porteur peut constituer l'équipe.
    assert (
        client_for(awa)
        .post("/api/assistant/team/", {"project_id": str(project.id)}, format="json")
        .status_code
        == 403
    )

    with django_capture_on_commit_callbacks(execute=True):
        invited = auth_client.post(
            "/api/assistant/team/invite/",
            {"project_id": str(project.id), "username": "awa", "message": "Rejoins-nous !"},
            format="json",
        )
    assert invited.status_code == 204
    kinds = [n["kind"] for n in client_for(awa).get("/api/notifications/").data["results"]]
    assert "team_invite" in kinds
