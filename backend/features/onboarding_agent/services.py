"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from core.exceptions import DomainError
from integrations import github

from .events import guide_finished
from .models import OnboardingGuide

# Un guide récent sur le même dépôt est réutilisé plutôt que régénéré (coût de l'IA).
REUSE_FOR = timedelta(days=7)


@transaction.atomic
def request_guide(*, user, repo_url: str, project_id=None) -> OnboardingGuide:
    repo_url = repo_url.strip().rstrip("/").removesuffix(".git")
    try:
        github.parse_repo_url(repo_url)
    except github.GitHubError as exc:
        raise DomainError(str(exc), code="invalid_repo") from exc

    recent = (
        OnboardingGuide.objects.alive()
        .filter(
            repo_url__iexact=repo_url,
            created_at__gte=timezone.now() - REUSE_FOR,
        )
        .exclude(status=OnboardingGuide.Status.FAILED)
        .order_by("-created_at")
        .first()
    )
    if recent:
        return recent

    guide = OnboardingGuide.objects.create(
        requested_by=user, repo_url=repo_url, project_id=project_id
    )
    from .tasks import ai_build_onboarding_guide

    transaction.on_commit(lambda: ai_build_onboarding_guide.delay(str(guide.id)))
    return guide


def store_result(*, guide_id, content: str = "", commit_sha: str = "", error: str = "") -> None:
    guide = OnboardingGuide.objects.filter(id=guide_id).first()
    if guide is None:
        return
    guide.status = OnboardingGuide.Status.READY if content else OnboardingGuide.Status.FAILED
    guide.content = content
    guide.commit_sha = commit_sha
    guide.error = error[:300]
    guide.save()
    guide_finished.send(
        sender=OnboardingGuide,
        guide_id=guide.id,
        user_id=guide.requested_by_id,
        repo_url=guide.repo_url,
        ready=bool(content),
    )
