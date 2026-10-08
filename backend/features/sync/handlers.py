"""Tables de la copie locale (packages/sync-schema) -> service d'écriture de la feature."""

from features.discussions import services as discussion_services
from features.feed import services as feed_services
from features.profiles import services as profile_services
from features.projects import services as project_services
from features.qa import services as qa_services
from features.snippets import services as snippet_services


def _profile(*, user, op, record_id, data):
    if op == "DELETE":
        raise ValueError("Un profil ne se supprime pas depuis la synchro.")
    profile_services.apply_offline_update(user=user, profile_id=record_id, data=data)


WRITERS = {
    "posts": feed_services.apply_offline_write,
    "comments": discussion_services.apply_offline_write,
    "questions": qa_services.apply_offline_question,
    "answers": qa_services.apply_offline_answer,
    "snippets": snippet_services.apply_offline_write,
    "projects": project_services.apply_offline_write,
    "profiles": _profile,
}
