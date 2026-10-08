"""API GitHub / GitLab : OAuth, profil, dépôts, issues.

Sert aussi à l'agent d'onboarding pour lire le contenu d'un dépôt.
"""

import base64
import re
from dataclasses import dataclass
from urllib.parse import quote

import httpx
from django.conf import settings

GITHUB_API = "https://api.github.com"
_REPO_URL = re.compile(r"^https?://(?:www\.)?github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")
GOOD_FIRST_LABELS = ("good first issue", "good-first-issue", "help wanted", "beginner")


class GitHubError(Exception):
    pass


@dataclass(frozen=True)
class OAuthIdentity:
    provider: str
    uid: str
    username: str
    email: str
    name: str
    avatar_url: str
    access_token: str


def parse_repo_url(url: str) -> tuple[str, str]:
    """« https://github.com/owner/name » -> (owner, name). Lève GitHubError sinon."""
    match = _REPO_URL.match(url.strip())
    if not match:
        raise GitHubError("Seuls les dépôts https://github.com/<owner>/<repo> sont pris en charge.")
    return match.group(1), match.group(2)


def _github(token: str | None = None) -> httpx.Client:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = token or settings.GITHUB_TOKEN
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.Client(base_url=GITHUB_API, headers=headers, timeout=20)


def _get(client: httpx.Client, path: str, **params):
    try:
        response = client.get(path, params=params or None)
    except httpx.HTTPError as exc:
        raise GitHubError(str(exc)) from exc
    if response.status_code == 404:
        return None
    if response.status_code >= 400:
        raise GitHubError(f"GitHub {response.status_code} sur {path}")
    return response.json()


# ── OAuth ──


def exchange_github_code(code: str, redirect_uri: str | None = None) -> OAuthIdentity:
    try:
        response = httpx.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri or settings.OAUTH_REDIRECT_URI,
            },
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise GitHubError(str(exc)) from exc
    token = response.json().get("access_token")
    if not token:
        raise GitHubError("Code GitHub invalide ou expiré.")

    with _github(token) as client:
        user = _get(client, "/user")
        email = user.get("email") or ""
        if not email:
            emails = _get(client, "/user/emails") or []
            primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
            email = primary["email"] if primary else ""
    return OAuthIdentity(
        provider="github",
        uid=str(user["id"]),
        username=user["login"],
        email=email,
        name=user.get("name") or "",
        avatar_url=user.get("avatar_url") or "",
        access_token=token,
    )


def exchange_gitlab_code(code: str, redirect_uri: str | None = None) -> OAuthIdentity:
    base = settings.GITLAB_URL.rstrip("/")
    try:
        response = httpx.post(
            f"{base}/oauth/token",
            data={
                "client_id": settings.GITLAB_CLIENT_ID,
                "client_secret": settings.GITLAB_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri or settings.OAUTH_REDIRECT_URI,
            },
            timeout=20,
        )
        token = response.json().get("access_token")
        if not token:
            raise GitHubError("Code GitLab invalide ou expiré.")
        user = httpx.get(
            f"{base}/api/v4/user", headers={"Authorization": f"Bearer {token}"}, timeout=20
        ).json()
    except httpx.HTTPError as exc:
        raise GitHubError(str(exc)) from exc
    return OAuthIdentity(
        provider="gitlab",
        uid=str(user["id"]),
        username=user["username"],
        email=user.get("email") or "",
        name=user.get("name") or "",
        avatar_url=user.get("avatar_url") or "",
        access_token=token,
    )


# ── Dépôts ──


def get_repo(owner: str, name: str) -> dict | None:
    with _github() as client:
        repo = _get(client, f"/repos/{owner}/{name}")
    if repo is None:
        return None
    return {
        "full_name": repo["full_name"],
        "description": repo.get("description") or "",
        "stars": repo.get("stargazers_count", 0),
        "language": repo.get("language") or "",
        "topics": repo.get("topics") or [],
        "default_branch": repo.get("default_branch") or "main",
        "html_url": repo["html_url"],
    }


def list_good_first_issues(owner: str, name: str, *, limit: int = 30) -> list[dict]:
    issues: dict[int, dict] = {}
    with _github() as client:
        for label in GOOD_FIRST_LABELS:
            batch = _get(
                client,
                f"/repos/{owner}/{name}/issues",
                labels=label,
                state="open",
                per_page=limit,
            )
            for issue in batch or []:
                if "pull_request" in issue:
                    continue
                issues[issue["number"]] = {
                    "number": issue["number"],
                    "title": issue["title"],
                    "url": issue["html_url"],
                    "labels": [lbl["name"] for lbl in issue.get("labels", [])],
                }
    return list(issues.values())[:limit]


def get_file(owner: str, name: str, path: str) -> str | None:
    with _github() as client:
        data = _get(client, f"/repos/{owner}/{name}/contents/{quote(path)}")
    if not data or isinstance(data, list) or data.get("encoding") != "base64":
        return None
    return base64.b64decode(data["content"]).decode("utf-8", errors="replace")


def get_readme(owner: str, name: str) -> str | None:
    with _github() as client:
        data = _get(client, f"/repos/{owner}/{name}/readme")
    if not data:
        return None
    return base64.b64decode(data["content"]).decode("utf-8", errors="replace")


def get_tree(owner: str, name: str, branch: str, *, limit: int = 300) -> list[str]:
    """Chemins des fichiers du dépôt (tronqué), pour donner la carte du projet à l'agent."""
    with _github() as client:
        data = _get(client, f"/repos/{owner}/{name}/git/trees/{quote(branch)}", recursive=1)
    if not data:
        return []
    return [item["path"] for item in data.get("tree", []) if item.get("type") == "blob"][:limit]


def get_latest_commit_sha(owner: str, name: str, branch: str) -> str:
    with _github() as client:
        data = _get(client, f"/repos/{owner}/{name}/commits/{quote(branch)}")
    return (data or {}).get("sha", "")


def list_user_repos(username: str, *, limit: int = 10) -> list[dict]:
    """Dépôts publics récents d'un utilisateur (matière première de la bio IA)."""
    with _github() as client:
        repos = _get(client, f"/users/{username}/repos", sort="updated", per_page=limit)
    return [
        {
            "name": repo["name"],
            "description": repo.get("description") or "",
            "language": repo.get("language") or "",
            "stars": repo.get("stargazers_count", 0),
        }
        for repo in repos or []
        if not repo.get("fork")
    ]


def get_user_overview(username: str, *, repo_limit: int = 100) -> dict | None:
    """Profil public d'un compte GitHub : dépôts, étoiles, langages (section du profil AfriDev).

    None si le compte n'existe pas ; GitHubError si GitHub est injoignable.
    """
    with _github() as client:
        user = _get(client, f"/users/{username}")
        if user is None:
            return None
        repos = _get(client, f"/users/{username}/repos", sort="pushed", per_page=repo_limit) or []
    own = [repo for repo in repos if not repo.get("fork")]
    languages: dict[str, int] = {}
    for repo in own:
        if repo.get("language"):
            languages[repo["language"]] = languages.get(repo["language"], 0) + 1
    top = sorted(own, key=lambda repo: repo.get("stargazers_count", 0), reverse=True)[:4]
    return {
        "login": user.get("login", username),
        "html_url": user.get("html_url", f"https://github.com/{username}"),
        "public_repos": user.get("public_repos", 0),
        "followers": user.get("followers", 0),
        "total_stars": sum(repo.get("stargazers_count", 0) for repo in own),
        "top_languages": [
            {"name": name, "repos": count}
            for name, count in sorted(languages.items(), key=lambda item: (-item[1], item[0]))[:6]
        ],
        "top_repos": [
            {
                "name": repo["name"],
                "url": repo.get("html_url", ""),
                "description": repo.get("description") or "",
                "language": repo.get("language") or "",
                "stars": repo.get("stargazers_count", 0),
            }
            for repo in top
        ],
    }
