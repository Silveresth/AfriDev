"""Agent d'onboarding : lit le dépôt via integrations.github et produit un guide de démarrage
(modèle « smart »)."""

from integrations import github, llm

from .prompts import load

# Fichiers de configuration qui révèlent la stack et les commandes du projet.
MANIFESTS = [
    "CONTRIBUTING.md",
    "package.json",
    "pnpm-workspace.yaml",
    "pyproject.toml",
    "requirements.txt",
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "composer.json",
    "Gemfile",
    "pubspec.yaml",
    "Makefile",
    "docker-compose.yml",
    ".env.example",
]
MAX_FILE_CHARS = 4000
MAX_README_CHARS = 8000
MAX_TREE_PATHS = 250


class AgentError(Exception):
    pass


def _section(title: str, body: str) -> str:
    return f"### {title}\n{body.strip()}\n"


def build_guide(repo_url: str) -> tuple[str, str]:
    """Renvoie (guide Markdown, sha du commit lu)."""
    try:
        owner, name = github.parse_repo_url(repo_url)
        repo = github.get_repo(owner, name)
        if repo is None:
            raise AgentError("Dépôt introuvable ou privé.")
        branch = repo["default_branch"]
        sha = github.get_latest_commit_sha(owner, name, branch)
        tree = github.get_tree(owner, name, branch, limit=MAX_TREE_PATHS)
        readme = github.get_readme(owner, name) or ""
        present = set(tree)
        files = {path: github.get_file(owner, name, path) for path in MANIFESTS if path in present}
        issues = github.list_good_first_issues(owner, name, limit=8)
    except github.GitHubError as exc:
        raise AgentError(str(exc)) from exc

    parts = [
        _section(
            "Dépôt",
            f"{repo['full_name']} — {repo['description']}\nLangage principal : {repo['language']}"
            f"\nTopics : {', '.join(repo['topics'])}\nBranche : {branch}",
        ),
        _section("Fichiers", "\n".join(tree) or "(liste indisponible)"),
        _section("README", readme[:MAX_README_CHARS] or "(absent)"),
    ]
    parts += [
        _section(path, content[:MAX_FILE_CHARS]) for path, content in files.items() if content
    ]
    parts.append(
        _section(
            "Good first issues",
            "\n".join(f"- #{i['number']} {i['title']} ({i['url']})" for i in issues) or "(aucune)",
        )
    )

    try:
        completion = llm.complete(
            model=llm.SMART_MODEL,
            system=load("guide.md"),
            prompt="\n".join(parts),
            max_tokens=2000,
            temperature=0.2,
        )
    except llm.LLMError as exc:
        raise AgentError(str(exc)) from exc
    return completion.text.strip(), sha
