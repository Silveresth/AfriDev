"""Appels au modèle (depuis les tâches Celery uniquement) et nettoyage de leurs réponses.

Le modèle peut renvoyer un JSON incomplet ou hors bornes : tout est borné et typé ici, pour que
l'API ne renvoie jamais une forme inattendue aux clients.
"""

import re

from features.knowledge import selectors as knowledge_selectors
from integrations import llm

from . import context
from .prompts import load

SEVERITIES = {"critique", "important", "mineur"}
CATEGORIES = {"bug", "securite", "performance", "robustesse", "lisibilite"}
SCOPES = {"people", "jobs", "questions", "snippets", "projects", "all"}
JOB_FILTERS = {"remote", "country", "tech", "contract"}


def _int(value, low: int = 0, high: int = 100) -> int:
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return low


def _str(value, size: int) -> str:
    return " ".join(str(value or "").split())[:size]


_EMOJI = re.compile(
    r"[\U0001f000-\U0001faff\U00002600-\U000027bf\U00002b00-\U00002bff\ufe0f\u200d]+"
)


def _plain(value, size: int) -> str:
    """Texte affiché tel quel dans l'interface : sans emoji."""
    return _str(_EMOJI.sub("", str(value or "")), size)


def _list(value, size: int) -> list:
    return list(value)[:size] if isinstance(value, list) else []


def job_match(*, user_id, job) -> dict:
    data = llm.complete_json(
        model=llm.SMART_MODEL,
        system=load("job_match.md"),
        prompt=f"PROFIL\n{context.member_profile(user_id=user_id)}\n\nOFFRE\n{context.job_offer(job)}",
        max_tokens=700,
    )
    return {
        "score": _int(data.get("score")),
        "verdict": _str(data.get("verdict"), 240),
        "strengths": [_str(s, 200) for s in _list(data.get("strengths"), 3) if s],
        "gaps": [_str(s, 200) for s in _list(data.get("gaps"), 3) if s],
        "plan": [
            {"step": _str(step.get("step"), 200), "resource": _str(step.get("resource"), 200)}
            for step in _list(data.get("plan"), 4)
            if isinstance(step, dict) and step.get("step")
        ],
    }


def code_review(*, code: str, language: str) -> dict:
    data = llm.complete_json(
        model=llm.SMART_MODEL,
        system=load("code_review.md"),
        prompt=context.numbered_code(code, language),
        max_tokens=1600,
        temperature=0.2,
    )
    issues = []
    for issue in _list(data.get("issues"), 8):
        if not isinstance(issue, dict) or not issue.get("title"):
            continue
        line = issue.get("line")
        issues.append(
            {
                "severity": issue.get("severity")
                if issue.get("severity") in SEVERITIES
                else "mineur",
                "category": issue.get("category")
                if issue.get("category") in CATEGORIES
                else "robustesse",
                "line": _int(line, 1, 100_000) if isinstance(line, int | float) else None,
                "title": _str(issue.get("title"), 140),
                "detail": _str(issue.get("detail"), 600),
                "suggestion": str(issue.get("suggestion") or "")[:1200],
            }
        )
    return {
        "summary": _str(data.get("summary"), 400),
        "score": _int(data.get("score")),
        "issues": issues,
    }


def chat_replies(*, conversation, user_id) -> dict:
    history = context.chat_history(conversation=conversation, user_id=user_id)
    if not history:
        return {"replies": []}
    data = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("chat_replies.md"),
        prompt=history,
        max_tokens=200,
        temperature=0.7,
    )
    return {"replies": [_str(r, 120) for r in _list(data.get("replies"), 3) if r]}


def digest(*, user_id) -> dict | None:
    facts, count = context.digest_facts(user_id=user_id)
    if not count:
        return None
    data = llm.complete_json(
        model=llm.FAST_MODEL, system=load("digest.md"), prompt=facts, max_tokens=600
    )
    items = [
        {
            # Gardé pour les anciennes versions de l'appli ; les clients affichent une icône.
            "emoji": "•",
            "text": _plain(item.get("text"), 240),
            "url": item.get("url") if str(item.get("url") or "").startswith("/") else None,
        }
        for item in _list(data.get("items"), 5)
        if isinstance(item, dict) and item.get("text")
    ]
    if not items:
        return None
    return {"headline": _plain(data.get("headline"), 80) or "Votre résumé du jour", "items": items}


def scam_check(text: str) -> dict:
    data = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("scam_dm.md"),
        prompt=text[:2000],
        max_tokens=160,
        temperature=0,
    )
    try:
        confidence = max(0.0, min(1.0, float(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "scam": bool(data.get("scam")),
        "confidence": confidence,
        "warning": _str(data.get("warning"), 200),
    }


def team(*, project_text: str, candidates_text: str, allowed: set[str]) -> dict:
    data = llm.complete_json(
        model=llm.SMART_MODEL,
        system=load("team.md"),
        prompt=f"PROJET\n{project_text}\n\nCANDIDATS\n{candidates_text}",
        max_tokens=900,
    )
    picked = []
    for row in _list(data.get("candidates"), 5):
        username = str(row.get("username") or "").lstrip("@") if isinstance(row, dict) else ""
        if username.lower() in allowed and username.lower() not in {
            p["username"].lower() for p in picked
        }:
            picked.append(
                {
                    "username": username,
                    "fit": _int(row.get("fit")),
                    "role": _str(row.get("role"), 80),
                    "reason": _str(row.get("reason"), 240),
                }
            )
    return {"candidates": picked, "invitation": str(data.get("invitation") or "")[:600]}


PROFILE_ACTIONS = {
    "edit_profile",
    "link_github",
    "pin_content",
    "answer_questions",
    "publish_snippet",
    "add_project",
    "open_to_work",
    "none",
}
LEVELS = {"facile", "moyen"}


def profile_review(*, user_id) -> dict:
    data = llm.complete_json(
        model=llm.SMART_MODEL,
        system=load("profile_review.md"),
        prompt=context.profile_audit(user_id=user_id),
        max_tokens=900,
    )
    return {
        "score": _int(data.get("score")),
        "headline": _plain(data.get("headline"), 200),
        "strengths": [_plain(s, 200) for s in _list(data.get("strengths"), 3) if s],
        "improvements": [
            {
                "title": _plain(item.get("title"), 120),
                "detail": _plain(item.get("detail"), 400),
                "action": item.get("action") if item.get("action") in PROFILE_ACTIONS else "none",
            }
            for item in _list(data.get("improvements"), 5)
            if isinstance(item, dict) and item.get("title")
        ],
        "github": [_plain(s, 300) for s in _list(data.get("github"), 3) if s],
    }


# Plus strict que la réponse IA d'une question (0,25) : une source peu pertinente, citée dans
# une discussion libre, fait plus de tort que pas de source du tout.
ASK_MIN_SCORE = 0.45


def ask(*, question: str, history: list[dict]) -> dict:
    """Réponse appuyée sur les contenus de la plateforme, sources numérotées et citées."""
    previous = " ".join(turn["content"] for turn in history if turn["role"] == "user")[-500:]
    query = f"{previous}\n{question}".strip()
    hits = knowledge_selectors.semantic_search(query=query, limit=6, min_score=ASK_MIN_SCORE)
    if not hits:
        hits = knowledge_selectors.fulltext_search(query=question, limit=4)
    sources = "\n\n".join(
        f"[{n}] {hit.title} ({hit.source_type}, {hit.url})\n{hit.excerpt[:1200]}"
        for n, hit in enumerate(hits, start=1)
    )
    conversation = "\n".join(
        f"{'Membre' if turn['role'] == 'user' else 'AfriDev'} : {turn['content'][:800]}"
        for turn in history[-6:]
    )
    completion = llm.complete(
        model=llm.SMART_MODEL,
        system=load("ask.md"),
        prompt=(
            f"Sources :\n{sources or '(aucune source pertinente sur la plateforme)'}\n\n"
            f"Historique :\n{conversation or '(début de la conversation)'}\n\n"
            f"---\nQuestion : {question}"
        ),
        max_tokens=1100,
        temperature=0.2,
    )
    answer = completion.text.strip()
    cited = {int(n) for n in re.findall(r"\[(\d{1,2})\]", answer)}
    return {
        "answer": answer,
        "sources": [
            {"n": n, "title": hit.title, "url": hit.url, "type": hit.source_type}
            for n, hit in enumerate(hits, start=1)
            if n in cited
        ],
    }


def first_contributions(*, user_id, issues: list) -> list[dict]:
    """[{issue, level, why, first_step}] : issues choisies parmi `issues` (rangs vérifiés)."""
    if not issues:
        return []
    data = llm.complete_json(
        model=llm.SMART_MODEL,
        system=load("first_contributions.md"),
        prompt=f"MEMBRE\n{context.member_profile(user_id=user_id)}\n\nISSUES\n"
        f"{context.contribution_issues(issues)}",
        max_tokens=1000,
    )
    picks, seen = [], set()
    for row in _list(data.get("picks"), 5):
        if not isinstance(row, dict):
            continue
        # Rang hors de la liste : issue inventée, ignorée (jamais ramenée à la plus proche).
        raw = str(row.get("id") or "").strip().lstrip("#")
        rank = int(raw) if raw.isdigit() else 0
        if not 1 <= rank <= len(issues) or rank in seen:
            continue
        seen.add(rank)
        picks.append(
            {
                "issue": issues[rank - 1],
                "level": row.get("level") if row.get("level") in LEVELS else "moyen",
                "why": _plain(row.get("why"), 240),
                "first_step": _plain(row.get("first_step"), 240),
            }
        )
    return picks


def suggest_hubs(*, text: str, hubs: list[dict]) -> list[dict]:
    """[{hub, reason}] : 3 hubs au plus parmi `hubs` (slugs vérifiés)."""
    if not hubs:
        return []
    data = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("hub_suggest.md"),
        prompt=f"POST\n{text[:1500]}\n\nHUBS\n{context.hub_candidates(hubs)}",
        max_tokens=250,
        temperature=0,
    )
    by_slug = {hub["slug"]: hub for hub in hubs}
    picked = []
    for row in _list(data.get("hubs"), 3):
        slug = str(row.get("slug") or "").strip().lower() if isinstance(row, dict) else ""
        if slug in by_slug and slug not in {p["hub"]["slug"] for p in picked}:
            picked.append({"hub": by_slug[slug], "reason": _plain(row.get("reason"), 120)})
    return picked


def voice_query(text: str) -> dict:
    data = llm.complete_json(
        model=llm.FAST_MODEL,
        system=load("voice_search.md"),
        prompt=text[:500],
        max_tokens=150,
        temperature=0,
    )
    filters = data.get("filters") if isinstance(data.get("filters"), dict) else {}
    return {
        "query": _str(data.get("query"), 120) or _str(text, 120),
        "scope": data.get("scope") if data.get("scope") in SCOPES else "all",
        "filters": {k: _str(v, 40) for k, v in filters.items() if k in JOB_FILTERS and v},
    }
