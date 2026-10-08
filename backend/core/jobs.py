"""Résultats de tâches de fond éphémères (reformulation, transcription…).

Le client reçoit un job_id (HTTP 202), puis interroge GET /api/jobs/<job_id>/.
L'état vit dans le cache (Redis en production), partagé entre l'API et les workers Celery.
Pour un résultat durable, la feature stocke plutôt un statut sur son propre modèle.
"""

import uuid
from typing import Any

from django.core.cache import cache
from django.db import transaction

JOB_TTL_SECONDS = 60 * 60

PENDING = "pending"
DONE = "done"
FAILED = "failed"


def _key(job_id) -> str:
    return f"job:{job_id}"


def start_job(*, owner_id, task, **task_kwargs) -> str:
    """Enregistre le job puis lance la tâche Celery après la transaction en cours.

    La tâche reçoit `job_id` en argument nommé et doit appeler finish_job / fail_job.
    """
    job_id = str(uuid.uuid4())
    cache.set(_key(job_id), {"status": PENDING, "owner": str(owner_id)}, JOB_TTL_SECONDS)
    transaction.on_commit(lambda: task.delay(job_id=job_id, **task_kwargs))
    return job_id


def finish_job(job_id: str, result: Any) -> None:
    job = cache.get(_key(job_id)) or {}
    cache.set(_key(job_id), {**job, "status": DONE, "result": result}, JOB_TTL_SECONDS)


def fail_job(job_id: str, message: str) -> None:
    job = cache.get(_key(job_id)) or {}
    cache.set(_key(job_id), {**job, "status": FAILED, "error": message}, JOB_TTL_SECONDS)


def get_job(job_id, *, owner_id) -> dict | None:
    """Renvoie le job seulement à son propriétaire."""
    job = cache.get(_key(job_id))
    if not job or job.get("owner") != str(owner_id):
        return None
    return {
        "id": str(job_id),
        "status": job["status"],
        "result": job.get("result"),
        "error": job.get("error"),
    }
