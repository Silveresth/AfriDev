"""Tâches Celery de la feature (file « github »)."""

import logging

from celery import shared_task

from integrations import github

from . import selectors, services

logger = logging.getLogger(__name__)


@shared_task(autoretry_for=(github.GitHubError,), retry_backoff=60, max_retries=3)
def sync_project_repo(project_id: str) -> None:
    """Importe les métadonnées du dépôt et ses « good first issues »."""
    project = selectors.get_project(project_id=project_id)
    if project is None or not project.repo_url:
        return
    owner, name = github.parse_repo_url(project.repo_url)
    repo = github.get_repo(owner, name)
    if repo is None:
        services.store_repo_sync(
            project_id=project_id, repo=None, issues=[], error="Dépôt introuvable ou privé."
        )
        return
    issues = github.list_good_first_issues(owner, name)
    services.store_repo_sync(project_id=project_id, repo=repo, issues=issues)
