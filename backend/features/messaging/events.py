from django.dispatch import Signal

# Après l'enregistrement d'un message direct : message_id, conversation_id, sender_id,
# recipient_id, text (aperçu), body (texte complet, vide pour un média seul).
message_sent = Signal()
