"""Écritures. Seul point d'entrée en écriture."""

from django.db import transaction

from core.exceptions import DomainError, NotFoundError
from features.projects import selectors as project_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

from . import selectors
from .models import Reaction

_EXISTS = {
    "question": lambda pk: qa_selectors.get_question(question_id=pk) is not None,
    "snippet": lambda pk: snippet_selectors.get_public_snippet(snippet_id=pk) is not None,
    "project": lambda pk: project_selectors.get_project(project_id=pk) is not None,
}


@transaction.atomic
def vote(*, user, target_type: str, target_id, value: int) -> dict:
    """value : 1 (↑), -1 (↓) ou 0 (retrait). Renvoie le nouveau décompte du contenu."""
    exists = _EXISTS.get(target_type)
    if exists is None:
        raise DomainError("Type de contenu inconnu.", code="invalid_target")
    if value not in (-1, 0, 1):
        raise DomainError("Vote invalide (1, -1 ou 0).", code="invalid_vote")
    if not exists(target_id):
        raise NotFoundError("Contenu introuvable.")
    lookup = {"user": user, "target_type": target_type, "target_id": target_id}
    if value == 0:
        Reaction.objects.filter(**lookup).delete()
    else:
        Reaction.objects.update_or_create(**lookup, defaults={"value": value})
    return selectors.summaries(target_type=target_type, target_ids=[target_id], viewer_id=user.id)[
        target_id
    ]
