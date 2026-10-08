import pytest

from core.exceptions import DomainError
from features.knowledge import selectors as knowledge_selectors
from features.projects import selectors, services

pytestmark = pytest.mark.django_db(transaction=True)

REPO = {
    "full_name": "afridev/pay-kit",
    "description": "Kit de paiement mobile money",
    "stars": 120,
    "language": "TypeScript",
    "topics": ["mobile-money", "payments"],
    "default_branch": "main",
    "html_url": "https://github.com/afridev/pay-kit",
}


@pytest.fixture
def github(monkeypatch):
    issues = [
        {
            "number": 7,
            "title": "Ajouter Flooz",
            "url": "https://github.com/x/7",
            "labels": ["good first issue"],
        },
        {"number": 9, "title": "Docs en anglais", "url": "https://github.com/x/9", "labels": []},
    ]
    monkeypatch.setattr("integrations.github.get_repo", lambda owner, name: REPO)
    monkeypatch.setattr("integrations.github.list_good_first_issues", lambda owner, name: issues)
    return issues


def test_repo_url_must_be_github(user):
    with pytest.raises(DomainError):
        services.create_project(owner=user, name="X", repo_url="https://example.com/repo")


def test_create_syncs_repo_and_issues(user, github):
    project = services.create_project(
        owner=user, name="Pay Kit", repo_url="https://github.com/afridev/pay-kit"
    )
    project.refresh_from_db()
    assert project.stars == 120
    assert project.tags == ["typescript", "mobile-money", "payments"]
    assert project.description == "Kit de paiement mobile money"
    assert [i.number for i in selectors.list_open_issues(project_id=project.id)] == [9, 7]
    assert knowledge_selectors.is_indexed(source_type="project", source_id=project.id)

    # Une issue fermée disparaît à la synchro suivante.
    github.pop()
    services.request_repo_sync(project=project, user=user)
    assert [i.number for i in selectors.list_open_issues(project_id=project.id)] == [7]


def test_delete_removes_from_index(user, github):
    project = services.create_project(owner=user, name="Pay Kit", repo_url="https://github.com/a/b")
    services.delete_project(project=project, user=user)
    assert not knowledge_selectors.is_indexed(source_type="project", source_id=project.id)
