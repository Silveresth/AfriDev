"""Recommandation candidat <-> projet : recouvrement des technologies, pondéré.

Volontairement simple et explicable (« vous connaissez React et Django ») ;
peut être enrichi plus tard par la proximité des embeddings (features/knowledge).
"""

from dataclasses import dataclass

ALIASES = {
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "rn": "react-native",
    "reactnative": "react-native",
    "react.js": "react",
    "reactjs": "react",
    "node": "nodejs",
    "node.js": "nodejs",
    "next.js": "nextjs",
    "next": "nextjs",
    "vue.js": "vue",
    "vuejs": "vue",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "golang": "go",
    "drf": "django-rest-framework",
}
# Technologies proches : un recouvrement partiel compte à moitié (relation rendue symétrique).
_RELATED = {
    "react": {"react-native", "nextjs"},
    "react-native": {"react", "expo"},
    "expo": {"react-native"},
    "nextjs": {"react"},
    "django": {"python", "django-rest-framework"},
    "django-rest-framework": {"django", "python"},
    "flask": {"python"},
    "fastapi": {"python"},
    "javascript": {"typescript", "nodejs"},
    "typescript": {"javascript"},
    "nodejs": {"javascript", "typescript"},
    "kotlin": {"android", "java"},
    "java": {"kotlin"},
    "swift": {"ios"},
}
RELATED: dict[str, set[str]] = {}
for _skill, _neighbours in _RELATED.items():
    for _other in _neighbours:
        RELATED.setdefault(_skill, set()).add(_other)
        RELATED.setdefault(_other, set()).add(_skill)


@dataclass(frozen=True)
class Match:
    score: float
    matched: list[str]


def normalize(skills) -> set[str]:
    cleaned = set()
    for skill in skills or []:
        key = str(skill).strip().lower()
        if key:
            cleaned.add(ALIASES.get(key, key))
    return cleaned


def score(candidate_skills, project_tags, *, open_to_work: bool = False) -> Match:
    """Score entre 0 et 1 : part des technologies du projet couvertes par le candidat."""
    candidate = normalize(candidate_skills)
    project = normalize(project_tags)
    if not candidate or not project:
        return Match(0.0, [])

    exact = candidate & project
    partial = {tag for tag in project - exact if RELATED.get(tag, set()) & candidate}
    coverage = (len(exact) + 0.5 * len(partial)) / len(project)
    bonus = 0.05 if open_to_work else 0.0
    return Match(round(min(1.0, coverage + bonus), 3), sorted(exact | partial))
