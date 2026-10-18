"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé avec snippet_id=<UUID> quand un snippet devient public.
snippet_published = Signal()
# Envoyé avec snippet_id quand un snippet redevient privé ou est supprimé.
snippet_unpublished = Signal()
# Envoyé avec snippet_id, owner_id, reasons quand l'analyse IA le retire de la publication.
snippet_flagged = Signal()
# Envoyé après commit avec comment_id, snippet_id, owner_id, author_id, parent_author_id, text.
snippet_comment_created = Signal()
