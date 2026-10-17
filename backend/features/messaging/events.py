from django.dispatch import Signal

# Après l'enregistrement d'un message direct : conversation_id, sender_id, recipient_id, text.
message_sent = Signal()
