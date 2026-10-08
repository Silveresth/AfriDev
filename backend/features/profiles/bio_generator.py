"""Bio IA : génère une bio à partir du profil tech et des dépôts GitHub (modèle « smart »)."""

import logging

from integrations import github, llm

from .models import Profile
from .prompts import load

logger = logging.getLogger(__name__)

MAX_BIO_LENGTH = 600


def _repos_summary(github_username: str) -> str:
    if not github_username:
        return ""
    try:
        repos = github.list_user_repos(github_username, limit=8)
    except github.GitHubError:
        logger.warning("Dépôts GitHub indisponibles pour %s", github_username)
        return ""
    lines = [
        f"- {repo['name']} ({repo['language'] or '?'}, {repo['stars']}★) : {repo['description']}"
        for repo in repos
    ]
    return "\n".join(lines)


def generate_bio(profile: Profile) -> str:
    facts = [
        f"Nom affiché : {profile.display_name or profile.username}",
        f"Stack : {', '.join(profile.stack) or 'non renseignée'}",
    ]
    if profile.location:
        facts.append(f"Localisation : {profile.location}")
    if profile.bio:
        facts.append(f"Bio actuelle : {profile.bio}")
    repos = _repos_summary(profile.github_username)
    if repos:
        facts.append(f"Dépôts GitHub récents :\n{repos}")

    completion = llm.complete(
        model=llm.SMART_MODEL,
        system=load("bio.md"),
        prompt="\n".join(facts),
        max_tokens=300,
        temperature=0.6,
    )
    return completion.text.strip().strip('"')[:MAX_BIO_LENGTH]
