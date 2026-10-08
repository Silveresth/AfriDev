"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec application_id, project_id, project_name, project_owner_id, candidate_id.
application_submitted = Signal()
# Envoyé après commit avec application_id, project_id, project_name, candidate_id, accepted.
application_answered = Signal()
