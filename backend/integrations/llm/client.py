"""Client technique Groq : appel, cache des réponses, garde-fous et comptage des coûts.

Les prompts métier vivent dans chaque feature (features/<nom>/prompts/).
Ce module ne doit être appelé que depuis des tâches Celery (file « ai »).
"""

import json
import logging
from dataclasses import dataclass
from functools import lru_cache

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from core.utils import content_hash

logger = logging.getLogger(__name__)

# Niveaux de modèle ; le nom exact du modèle Groq est lu dans les réglages à chaque appel.
# Réponse instantanée (RAG), bio IA, agent d'onboarding.
SMART_MODEL = "smart"
# Tâches rapides : tags, doublons, modération, résumé en 3 points, traduction.
FAST_MODEL = "fast"


class LLMError(Exception):
    """Échec d'un appel au modèle (réseau, quota fournisseur, réponse inexploitable)."""


class LLMUnavailableError(LLMError):
    """Aucune clé GROQ_API_KEY configurée."""


@dataclass(frozen=True)
class Completion:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    cached: bool = False


def resolve_model(tier: str) -> str:
    if tier == SMART_MODEL:
        return settings.GROQ_SMART_MODEL
    if tier == FAST_MODEL:
        return settings.GROQ_FAST_MODEL
    return tier  # nom de modèle explicite


@lru_cache(maxsize=1)
def groq_client():
    from groq import Groq

    if not settings.GROQ_API_KEY:
        raise LLMUnavailableError("GROQ_API_KEY n'est pas configurée.")
    return Groq(api_key=settings.GROQ_API_KEY, max_retries=2, timeout=60)


def _create(
    *, model: str, system: str, prompt: str, max_tokens: int, temperature: float, json_mode: bool
) -> Completion:
    """Unique point de contact avec l'API (remplacé par un faux dans les tests)."""
    from groq import GroqError

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        response = groq_client().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=max_tokens,
            temperature=temperature,
            **kwargs,
        )
    except GroqError as exc:
        raise LLMError(str(exc)) from exc

    choice = response.choices[0]
    usage = response.usage
    return Completion(
        text=choice.message.content or "",
        model=response.model,
        input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
        output_tokens=getattr(usage, "completion_tokens", 0) or 0,
    )


def _record_usage(completion: Completion) -> None:
    """Compteurs journaliers par modèle (suivi des coûts, lisibles dans Redis)."""
    day = timezone.now().strftime("%Y-%m-%d")
    for kind, value in (("in", completion.input_tokens), ("out", completion.output_tokens)):
        key = f"llm_usage:{day}:{completion.model}:{kind}"
        cache.add(key, 0, 60 * 60 * 24 * 35)
        try:
            cache.incr(key, value)
        except ValueError:
            cache.set(key, value, 60 * 60 * 24 * 35)


def usage_by_day(*, days: int) -> dict[str, dict[str, dict[str, int]]]:
    """{"2026-10-05": {"llama-3.3-70b-versatile": {"input": 1200, "output": 300}}} pour les
    modèles configurés, d'après les compteurs de _record_usage (35 jours d'historique)."""
    from datetime import timedelta

    models = {settings.GROQ_SMART_MODEL, settings.GROQ_FAST_MODEL}
    today = timezone.now().date()
    keys = {
        f"llm_usage:{(today - timedelta(days=offset)).isoformat()}:{model}:{kind}": (
            offset,
            model,
            kind,
        )
        for offset in range(days)
        for model in models
        for kind in ("in", "out")
    }
    values = cache.get_many(list(keys))
    usage: dict[str, dict[str, dict[str, int]]] = {}
    for key, value in values.items():
        offset, model, kind = keys[key]
        day = (today - timedelta(days=offset)).isoformat()
        tokens = usage.setdefault(day, {}).setdefault(model, {"input": 0, "output": 0})
        tokens["input" if kind == "in" else "output"] += int(value or 0)
    return usage


def complete(
    *,
    model: str,
    system: str,
    prompt: str,
    max_tokens: int = 1024,
    temperature: float = 0.3,
    json_mode: bool = False,
    use_cache: bool = True,
) -> Completion:
    model_name = resolve_model(model)
    cache_key = "llm:" + content_hash(
        model_name, system, prompt, str(max_tokens), str(temperature), str(json_mode)
    )
    if use_cache:
        hit = cache.get(cache_key)
        if hit is not None:
            return Completion(**{**hit, "cached": True})

    completion = _create(
        model=model_name,
        system=system,
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        json_mode=json_mode,
    )
    _record_usage(completion)
    logger.info(
        "llm_call model=%s input_tokens=%s output_tokens=%s",
        completion.model,
        completion.input_tokens,
        completion.output_tokens,
    )
    if use_cache and completion.text:
        cache.set(
            cache_key,
            {
                "text": completion.text,
                "model": completion.model,
                "input_tokens": completion.input_tokens,
                "output_tokens": completion.output_tokens,
            },
            settings.LLM_CACHE_SECONDS,
        )
    return completion


def complete_json(*, model: str, system: str, prompt: str, **kwargs) -> dict:
    """Variante qui exige un objet JSON (le prompt doit mentionner « JSON »)."""
    completion = complete(model=model, system=system, prompt=prompt, json_mode=True, **kwargs)
    text = completion.text.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Réponse JSON invalide : {text[:200]}") from exc
    if not isinstance(data, dict):
        raise LLMError("La réponse JSON n'est pas un objet.")
    return data
