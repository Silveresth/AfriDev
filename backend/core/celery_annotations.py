"""Annotations Celery (CELERY_TASK_ANNOTATIONS) appliquées au démarrage du worker."""

from django.conf import settings


class AITaskLimits:
    """Durée maximale des tâches ai_* : au-delà de la limite douce, SoftTimeLimitExceeded est
    levée dans la tâche ; 30 s plus tard le processus est tué. Une tâche qui fixe déjà
    sa propre limite (agent d'onboarding) la garde."""

    def annotate(self, task):
        if not task.name.rsplit(".", 1)[-1].startswith("ai_") or task.soft_time_limit:
            return None
        soft = settings.AI_TASK_SOFT_TIME_LIMIT
        return {"soft_time_limit": soft, "time_limit": soft + 30}
