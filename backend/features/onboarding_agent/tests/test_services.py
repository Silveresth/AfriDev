import pytest

from core.exceptions import DomainError
from features.notifications import selectors as notification_selectors
from features.onboarding_agent import services
from features.onboarding_agent.models import OnboardingGuide

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def github(monkeypatch):
    repo = {
        "full_name": "afridev/pay-kit",
        "description": "Kit de paiement",
        "stars": 3,
        "language": "Python",
        "topics": [],
        "default_branch": "main",
        "html_url": "https://github.com/afridev/pay-kit",
    }
    files = {"pyproject.toml": "[project]\nname='pay-kit'", "CONTRIBUTING.md": "Forkez puis PR."}
    monkeypatch.setattr("integrations.github.get_repo", lambda o, n: repo)
    monkeypatch.setattr("integrations.github.get_latest_commit_sha", lambda o, n, b: "abc123")
    monkeypatch.setattr(
        "integrations.github.get_tree",
        lambda o, n, b, limit: [
            "README.md",
            "pyproject.toml",
            "CONTRIBUTING.md",
            "paykit/__init__.py",
        ],
    )
    monkeypatch.setattr("integrations.github.get_readme", lambda o, n: "# Pay Kit")
    monkeypatch.setattr("integrations.github.get_file", lambda o, n, path: files.get(path))
    monkeypatch.setattr("integrations.github.list_good_first_issues", lambda o, n, limit: [])


def test_guide_is_built_from_repository_content(user, github, fake_llm):
    fake_llm.when("agent d'onboarding", "## En bref\nUn kit de paiement.")
    guide = services.request_guide(user=user, repo_url="https://github.com/afridev/pay-kit.git")
    guide.refresh_from_db()

    assert guide.status == OnboardingGuide.Status.READY
    assert guide.commit_sha == "abc123"
    assert guide.repo_url == "https://github.com/afridev/pay-kit"
    prompt = fake_llm.calls[-1]["prompt"]
    assert "Forkez puis PR." in prompt and "paykit/__init__.py" in prompt
    assert "guide_ready" in [n.kind for n in notification_selectors.list_notifications(user=user)]

    # Un guide récent est réutilisé : pas de nouvel appel à l'IA.
    calls = len(fake_llm.calls)
    again = services.request_guide(user=user, repo_url="https://github.com/afridev/pay-kit")
    assert again.id == guide.id and len(fake_llm.calls) == calls


def test_failure_is_recorded(user, github):
    guide = services.request_guide(user=user, repo_url="https://github.com/afridev/pay-kit")
    guide.refresh_from_db()
    assert guide.status == OnboardingGuide.Status.FAILED
    assert "GROQ_API_KEY" in guide.error


def test_rejects_non_github_urls(user):
    with pytest.raises(DomainError):
        services.request_guide(user=user, repo_url="https://gitlab.com/a/b")
