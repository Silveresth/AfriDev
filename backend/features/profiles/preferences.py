"""Préférences d'accueil (onboarding) et « recette » du fil personnalisé.

Source unique pour le web et le mobile (GET /api/profiles/me/onboarding/) :
- niveau d'expérience : pondère questions débutant / contenus avancés ;
- objectifs : déterminent la part de chaque type de contenu dans le fil (feed_mix) ;
- thématiques : chacune se traduit en tags, ceux que portent posts, questions et snippets ;
- stack (maîtrisée) et technologies à apprendre : tags également.

Le fil (features.feed) et les recommandations (features.matchmaking) lisent `interests`
(tags normalisés) et `feed_mix` : la logique d'affichage reste explicable (« parce que vous
suivez Python et cherchez une mission »).
"""

from core.utils import normalize_tags

EXPERIENCE_LEVELS = {
    "student": "Étudiant·e / en reconversion",
    "junior": "Junior (0-2 ans)",
    "mid": "Confirmé·e (2-5 ans)",
    "senior": "Senior / Lead (5 ans et +)",
    "founder": "Fondateur·rice / Recruteur·se",
}

# Objectif -> poids ajoutés à chaque type de contenu (le fil en tire ses proportions).
GOALS = {
    "learn": {
        "label": "Apprendre et progresser",
        "weights": {"question": 2, "snippet": 3, "news": 1, "video": 2},
    },
    "help": {"label": "Aider les autres devs", "weights": {"question": 4, "post": 1}},
    "job": {"label": "Trouver un job ou une mission", "weights": {"job": 4, "event": 1}},
    "hire": {"label": "Recruter des talents", "weights": {"job": 2, "project": 2, "post": 1}},
    "collab": {
        "label": "Contribuer à des projets open source",
        "weights": {"project": 4, "snippet": 1},
    },
    "share": {"label": "Partager mes créations", "weights": {"post": 2, "video": 2, "snippet": 1}},
    "watch": {"label": "Faire ma veille tech", "weights": {"news": 4, "post": 1, "event": 1}},
}

# Base commune : chaque membre voit un peu de tout, même sans objectif déclaré.
BASE_MIX = {
    "post": 3,
    "question": 2,
    "snippet": 2,
    "project": 1,
    "job": 1,
    "event": 1,
    "news": 1,
    "video": 1,
}

# Thématiques présentées à l'accueil : libellé, technologies proposées, tags de contenu suivis.
TOPICS = {
    "web": {
        "label": "Web & Frontend",
        "suggest": ["react", "nextjs", "vue", "typescript", "tailwindcss", "svelte"],
        "tags": ["frontend", "web", "javascript", "css"],
    },
    "backend": {
        "label": "Backend & APIs",
        "suggest": ["python", "django", "fastapi", "nodejs", "go", "laravel", "postgresql"],
        "tags": ["backend", "api"],
    },
    "mobile": {
        "label": "Mobile",
        "suggest": ["flutter", "react-native", "kotlin", "swift", "expo"],
        "tags": ["mobile", "android", "ios"],
    },
    "devops": {
        "label": "Cloud & DevOps",
        "suggest": ["docker", "kubernetes", "aws", "terraform", "linux", "github-actions"],
        "tags": ["devops", "cloud", "ci-cd"],
    },
    "data_ai": {
        "label": "Data, IA & LLM",
        "suggest": ["python", "pytorch", "pandas", "llm", "langchain", "sql"],
        "tags": ["ia", "ai", "machine-learning", "data", "llm"],
    },
    "fintech": {
        "label": "FinTech & Mobile Money",
        "suggest": ["mobile-money", "api", "ussd", "paiement"],
        "tags": ["fintech", "mobile-money", "paiement", "ussd"],
    },
    "offline": {
        "label": "Hors-ligne & faible connectivité",
        "suggest": ["pwa", "sqlite", "ussd", "sms"],
        "tags": ["offline", "pwa", "ussd", "sms", "performance"],
    },
    "security": {
        "label": "Cybersécurité",
        "suggest": ["owasp", "linux", "pentest", "cryptographie"],
        "tags": ["securite", "security", "cybersecurite"],
    },
    "opensource": {
        "label": "Open Source",
        "suggest": ["git", "github", "documentation"],
        "tags": ["open-source", "opensource"],
    },
    "career": {
        "label": "Carrière & Freelance",
        "suggest": ["freelance", "entretien", "portfolio"],
        "tags": ["carriere", "freelance", "emploi", "entretien"],
    },
    "startup": {
        "label": "Startups & Produit",
        "suggest": ["mvp", "produit", "saas"],
        "tags": ["startup", "produit", "saas"],
    },
    "design": {
        "label": "UI/UX & Design",
        "suggest": ["figma", "design-system", "accessibilite"],
        "tags": ["design", "ux", "ui", "accessibilite"],
    },
}

# Niveau -> poids ajoutés (débutants : plus d'entraide et de code ; seniors : projets, posts).
LEVEL_BONUS = {
    "student": {"question": 1, "snippet": 1},
    "junior": {"question": 1, "snippet": 1},
    "mid": {},
    "senior": {"project": 1, "post": 1},
    "founder": {"project": 1, "post": 1},
}

MAX_INTERESTS = 40

# Langages GitHub -> tags AfriDev (import de la stack en un clic).
GITHUB_LANGUAGE_TAGS = {
    "JavaScript": "javascript",
    "TypeScript": "typescript",
    "Python": "python",
    "Jupyter Notebook": "python",
    "Go": "go",
    "Rust": "rust",
    "Java": "java",
    "Kotlin": "kotlin",
    "Swift": "swift",
    "Dart": "flutter",
    "PHP": "php",
    "Ruby": "ruby",
    "C#": "csharp",
    "C++": "cpp",
    "C": "c",
    "Shell": "bash",
    "Vue": "vue",
    "Svelte": "svelte",
    "HCL": "terraform",
    "Dockerfile": "docker",
    "Elixir": "elixir",
    "Scala": "scala",
}


def catalogue() -> dict:
    """Ce que les écrans d'accueil affichent (identique sur web et mobile).

    Les poids sont exposés : l'aperçu « votre fil » se recalcule en direct côté client
    avec la même règle que feed_mix(), sans dupliquer de valeurs dans les applications.
    """
    return {
        "base_mix": BASE_MIX,
        "levels": [
            {"id": key, "label": label, "weights": LEVEL_BONUS.get(key, {})}
            for key, label in EXPERIENCE_LEVELS.items()
        ],
        "goals": [
            {"id": key, "label": goal["label"], "weights": goal["weights"]}
            for key, goal in GOALS.items()
        ],
        "topics": [
            {"id": key, "label": topic["label"], "suggest": topic["suggest"]}
            for key, topic in TOPICS.items()
        ],
    }


def topics_to_tags(topic_ids) -> list[str]:
    tags: list[str] = []
    for topic_id in topic_ids or []:
        tags.extend(TOPICS.get(topic_id, {}).get("tags", []))
    return tags


def selected_topics(interests) -> list[str]:
    """Thématiques dont tous les tags figurent dans `interests` (réaffichage du choix)."""
    chosen = set(interests or [])
    return [key for key, topic in TOPICS.items() if set(topic["tags"]) <= chosen]


def clean_tags(values, *, limit: int) -> list[str]:
    """Tags normalisés comme ceux des contenus (« React Native » -> « react-native »)."""
    return normalize_tags([str(v).strip().replace(" ", "-") for v in values or []], limit=limit)


def build_interests(*, topics, learning, stack) -> list[str]:
    """Tags suivis : thématiques + technologies à apprendre + stack maîtrisée, sans doublon."""
    return clean_tags(
        [*topics_to_tags(topics), *(learning or []), *(stack or [])], limit=MAX_INTERESTS
    )


def feed_mix(*, goals, level: str = "") -> dict[str, int]:
    """Part (en %) de chaque type de contenu dans le fil, d'après les objectifs et le niveau."""
    weights = dict(BASE_MIX)
    bonuses = [GOALS.get(goal, {}).get("weights", {}) for goal in goals or []]
    bonuses.append(LEVEL_BONUS.get(level, {}))
    for bonus in bonuses:
        for kind, extra in bonus.items():
            weights[kind] = weights.get(kind, 0) + extra
    total = sum(weights.values())
    mix = {kind: round(value * 100 / total) for kind, value in weights.items()}
    # Arrondis : le reliquat va au type le plus représenté pour un total exact de 100.
    top = max(mix, key=mix.get)
    mix[top] += 100 - sum(mix.values())
    return dict(sorted(mix.items(), key=lambda item: -item[1]))


def github_languages_to_tags(languages) -> list[str]:
    tags = [GITHUB_LANGUAGE_TAGS.get(lang["name"], lang["name"]) for lang in languages or []]
    return clean_tags(tags, limit=10)
