import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _run_on_commit(monkeypatch):
    monkeypatch.setattr("django.db.transaction.on_commit", lambda func, *a, **kw: func())


def _result(client, response):
    assert response.status_code == 202, response.data
    job = client.get(f"/api/jobs/{response.data['job_id']}/").data
    assert job["status"] == "done", job
    return job["result"]


def test_profile_review_is_bounded(auth_client, fake_llm):
    fake_llm.when(
        "coach carrière",
        {
            "score": 250,
            "headline": "Bon départ",
            "strengths": ["Stack claire"],
            "improvements": [
                {
                    "title": "Ajoutez une photo",
                    "detail": "Plus de confiance",
                    "action": "edit_profile",
                },
                {"title": "Action inconnue", "detail": "…", "action": "hack"},
                "pas un objet",
            ],
            "github": ["Ajoutez un README"],
        },
    )
    result = _result(auth_client, auth_client.post("/api/assistant/profile-review/"))
    assert result["score"] == 100
    assert [i["action"] for i in result["improvements"]] == ["edit_profile", "none"]
    assert result["github"] == ["Ajoutez un README"]


def test_ask_keeps_only_cited_sources(auth_client, fake_llm, monkeypatch):
    from features.knowledge.selectors import Hit

    hits = [
        Hit("question", "1", "Déployer Django", "/questions/1", "Utilisez gunicorn.", 0.9),
        Hit("snippet", "2", "Dockerfile", "/snippets/2", "FROM python", 0.8),
    ]
    monkeypatch.setattr("features.knowledge.selectors.semantic_search", lambda **kwargs: hits)
    fake_llm.when("assistant de la plateforme", "Utilisez gunicorn [1]. Voir aussi [7].")
    result = _result(
        auth_client,
        auth_client.post(
            "/api/assistant/ask/",
            {
                "question": "Comment déployer Django ?",
                "history": [{"role": "user", "content": "Salut"}],
            },
            format="json",
        ),
    )
    assert result["answer"].startswith("Utilisez gunicorn")
    assert result["sources"] == [
        {"n": 1, "title": "Déployer Django", "url": "/questions/1", "type": "question"}
    ]


def test_ask_rejects_empty_question(auth_client, fake_llm):
    response = auth_client.post("/api/assistant/ask/", {"question": "  "}, format="json")
    assert response.status_code == 400


def test_first_contributions_ignores_invented_issues(auth_client, user, fake_llm):
    from features.projects import selectors as project_selectors
    from features.projects import services as project_services

    project = project_services.create_project(owner=user, name="Kora", tags=["python"])
    project_services.store_repo_sync(
        project_id=project.id,
        repo={"language": "Python", "stars": 0, "topics": []},
        issues=[
            {"number": 3, "title": "Typo README", "url": "https://github.com/k/k/issues/3"},
            {
                "number": 9,
                "title": "Ajouter un test",
                "url": "https://github.com/k/k/issues/9",
                "labeled": False,
            },
        ],
    )
    labeled = project_selectors.list_open_issues(project_id=project.id).get()
    fake_llm.when(
        "première contribution",
        {
            "picks": [
                {"id": "#1", "level": "facile", "why": "Court", "first_step": "Lire le README"},
                {"id": "#42"},
            ]
        },
    )
    result = _result(auth_client, auth_client.post("/api/assistant/first-contributions/"))
    assert [p["issue_id"] for p in result["picks"]] == [str(labeled.id)]
    assert result["picks"][0]["project"]["name"] == "Kora"


def test_hub_suggestions_only_existing_hubs(auth_client, user, fake_llm):
    from features.hubs import services as hub_services

    hub_services.create_hub(
        creator=user, name="Python Sénégal", slug="python-senegal", description="Python"
    )
    fake_llm.when(
        "bon hub",
        {
            "hubs": [
                {"slug": "python-senegal", "reason": "Sujet Python"},
                {"slug": "invente", "reason": "?"},
            ]
        },
    )
    result = _result(
        auth_client,
        auth_client.post(
            "/api/assistant/hub-suggest/",
            {"title": "Mon API Python en production", "tags": ["python"]},
            format="json",
        ),
    )
    assert [h["slug"] for h in result["hubs"]] == ["python-senegal"]
    assert result["hubs"][0]["reason"] == "Sujet Python"
