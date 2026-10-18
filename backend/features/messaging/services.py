"""Écritures. Seul point d'entrée en écriture."""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from core.exceptions import DomainError, NotFoundError, PermissionDeniedError
from features.media import selectors as media_selectors

from .events import message_sent
from .models import Conversation, Message

MAX_LENGTH = 2000
# Comme WhatsApp : modifiable 15 minutes, supprimable pour tout le monde pendant 2 jours.
EDIT_WINDOW = timedelta(minutes=15)
REVOKE_WINDOW = timedelta(days=2)
MAX_BULK_DELETE = 100
REVOKED_PREVIEW = "🚫 Message supprimé"


def open_conversation(*, user, other_user_id) -> Conversation:
    """Conversation avec un autre membre, créée au besoin (une seule par duo)."""
    if other_user_id == user.id:
        raise DomainError("Vous ne pouvez pas vous écrire à vous-même.", code="self_message")
    low, high = sorted([user.id, other_user_id], key=str)
    existing = Conversation.objects.filter(user_low_id=low, user_high_id=high).first()
    if existing:
        return existing
    try:
        with transaction.atomic():
            return Conversation.objects.create(user_low_id=low, user_high_id=high)
    except IntegrityError:
        return Conversation.objects.get(user_low_id=low, user_high_id=high)


MEDIA_PREVIEWS = {"image": "📷 Photo", "video": "🎬 Vidéo", "audio": "🎤 Message vocal"}


def _clean_body(body: str) -> str:
    body = (body or "").strip()
    if len(body) > MAX_LENGTH:
        raise DomainError(f"{MAX_LENGTH} caractères au maximum.", code="message_too_long")
    return body


def _preview(message: Message, kind: str | None = None) -> str:
    if message.revoked_at:
        return REVOKED_PREVIEW
    if not kind and message.media_id:
        kind = (
            media_selectors.describe_many(asset_ids={message.media_id})
            .get(message.media_id, {})
            .get("kind")
        )
    return (" ".join(message.body.split()) or MEDIA_PREVIEWS.get(kind, "Pièce jointe"))[:140]


def _refresh_preview(conversation: Conversation) -> None:
    """Après une modification ou une suppression : l'aperçu suit le dernier message."""
    last = Message.objects.alive().filter(conversation=conversation).order_by("-created_at").first()
    preview = _preview(last) if last else ""
    if conversation.last_message_preview != preview:
        conversation.last_message_preview = preview
        conversation.save(update_fields=["last_message_preview", "updated_at"])


@transaction.atomic
def send_message(
    *, conversation: Conversation, sender, body: str = "", media_id=None, reply_to_id=None
) -> Message:
    """Texte, photo, vidéo ou message vocal (média déjà envoyé par l'expéditeur), éventuellement
    en réponse à un message précis de la même conversation."""
    body = _clean_body(body)
    if not body and not media_id:
        raise DomainError("Le message est vide.", code="empty_message")
    if sender.id not in (conversation.user_low_id, conversation.user_high_id):
        raise NotFoundError("Conversation introuvable.")
    media = None
    if media_id:
        media = media_selectors.get_owned_asset(asset_id=media_id, owner_id=sender.id)
        if media is None:
            raise DomainError("Média introuvable : renvoyez le fichier.", code="invalid_media")
    reply_to = None
    if reply_to_id:
        reply_to = (
            Message.objects.alive()
            .filter(id=reply_to_id, conversation=conversation, revoked_at__isnull=True)
            .first()
        )
        if reply_to is None:
            raise DomainError("Le message cité n'existe plus.", code="invalid_reply")
    message = Message.objects.create(
        conversation=conversation,
        sender=sender,
        body=body,
        media_id=media.id if media else None,
        reply_to=reply_to,
    )
    preview = _preview(message, media.kind if media else None)
    conversation.last_message_at = message.created_at
    conversation.last_message_preview = preview
    conversation.last_sender = sender
    # L'expéditeur a forcément lu la conversation jusqu'à son propre message.
    field = "low_read_at" if conversation.user_low_id == sender.id else "high_read_at"
    setattr(conversation, field, message.created_at)
    conversation.save(
        update_fields=[
            "last_message_at",
            "last_message_preview",
            "last_sender",
            field,
            "updated_at",
        ]
    )
    recipient_id = conversation.other_id(sender.id)
    transaction.on_commit(
        lambda: message_sent.send(
            sender=Message,
            message_id=message.id,
            conversation_id=conversation.id,
            sender_id=sender.id,
            recipient_id=recipient_id,
            text=preview,
            body=body,
        )
    )
    return message


def set_risk_note(*, message_id, note: str) -> None:
    """Avertissement affiché au destinataire (arnaque probable détectée par l'IA)."""
    Message.objects.filter(id=message_id).update(risk_note=note[:200])


def mark_read(*, conversation: Conversation, user) -> Conversation:
    field = "low_read_at" if conversation.user_low_id == user.id else "high_read_at"
    setattr(conversation, field, timezone.now())
    conversation.save(update_fields=[field, "updated_at"])
    return conversation


@transaction.atomic
def edit_message(*, message: Message, user, body: str) -> Message:
    """Corrige le texte (ou la légende d'un média) de son propre message, 15 minutes au plus."""
    if message.sender_id != user.id:
        raise PermissionDeniedError("Seul l'auteur peut modifier ce message.")
    if message.revoked_at:
        raise DomainError("Ce message a été supprimé.", code="message_revoked")
    if timezone.now() - message.created_at > EDIT_WINDOW:
        raise DomainError(
            "Un message ne peut plus être modifié après 15 minutes.", code="edit_expired"
        )
    body = _clean_body(body)
    if not body and not message.media_id:
        raise DomainError("Le message est vide.", code="empty_message")
    if body != message.body:
        message.body = body
        message.edited_at = timezone.now()
        message.save(update_fields=["body", "edited_at", "updated_at"])
        _refresh_preview(message.conversation)
    return message


@transaction.atomic
def delete_messages(
    *, conversation: Conversation, user, message_ids, for_everyone: bool = False
) -> int:
    """Suppression d'un ou plusieurs messages sélectionnés, comme sur WhatsApp.

    - pour moi : masqués de mon côté seulement (n'importe quels messages) ;
    - pour tout le monde : mes propres messages de moins de 2 jours ; leur contenu est effacé
      et chacun voit « Message supprimé ».
    """
    ids = list(dict.fromkeys(message_ids))[:MAX_BULK_DELETE]
    messages = list(Message.objects.alive().filter(conversation=conversation, id__in=ids))
    if not messages:
        return 0
    if for_everyone:
        now = timezone.now()
        if any(m.sender_id != user.id for m in messages):
            raise PermissionDeniedError(
                "Vous ne pouvez supprimer pour tout le monde que vos propres messages."
            )
        if any(now - m.created_at > REVOKE_WINDOW for m in messages):
            raise DomainError(
                "Trop ancien : un message ne peut plus être supprimé pour tout le monde "
                "après 2 jours. Supprimez-le pour vous.",
                code="revoke_expired",
            )
        Message.objects.filter(id__in=[m.id for m in messages]).update(
            body="", media_id=None, edited_at=None, revoked_at=now, updated_at=now
        )
        _refresh_preview(conversation)
        return len(messages)
    mine = [m.id for m in messages if m.sender_id == user.id]
    theirs = [m.id for m in messages if m.sender_id != user.id]
    Message.objects.filter(id__in=mine).update(hidden_for_sender=True, updated_at=timezone.now())
    Message.objects.filter(id__in=theirs).update(
        hidden_for_recipient=True, updated_at=timezone.now()
    )
    return len(messages)


def clear_conversation(*, conversation: Conversation, user) -> Conversation:
    """« Supprimer la discussion » pour soi : fil vidé, conversation retirée de la boîte de
    réception jusqu'au prochain message. L'autre membre garde tout."""
    now = timezone.now()
    prefix = "low" if conversation.user_low_id == user.id else "high"
    setattr(conversation, f"{prefix}_cleared_at", now)
    setattr(conversation, f"{prefix}_read_at", now)
    conversation.save(update_fields=[f"{prefix}_cleared_at", f"{prefix}_read_at", "updated_at"])
    return conversation
