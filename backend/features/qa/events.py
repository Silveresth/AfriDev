"""Signaux publiés vers les autres features."""

from django.dispatch import Signal

# Envoyé après commit avec question_id, author_id, text (modération IA).
question_created = Signal()
# Envoyé après commit avec answer_id, question_id, author_id, question_author_id, text.
answer_created = Signal()
# Envoyé après commit avec question_id, answer_id, answer_author_id (knowledge indexe le fil),
# et previous_author_ids : auteurs des réponses qui perdent le statut « acceptée » (karma).
answer_accepted = Signal()
# Envoyé après commit avec answer_id, author_id quand le vote sur une réponse change (karma).
answer_voted = Signal()
# Envoyé après commit avec question_id, author_id quand la réponse IA est prête.
ai_answer_ready = Signal()
