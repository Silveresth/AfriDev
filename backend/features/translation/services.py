"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

from django.db import IntegrityError, transaction

from core.utils import content_hash

from .models import Translation


def request_translation(*, user, text: str, target_language: str, mode: str) -> Translation:
    """Renvoie la traduction en cache si elle existe ; sinon la crée et lance l'IA."""
    text = text.strip()
    source_hash = content_hash(text)
    lookup = {"source_hash": source_hash, "target_language": target_language, "mode": mode}

    existing = Translation.objects.filter(**lookup).first()
    if existing and existing.status != Translation.Status.FAILED:
        return existing

    from .tasks import ai_translate

    with transaction.atomic():
        if existing:  # nouvel essai après un échec
            existing.status = Translation.Status.PENDING
            existing.save(update_fields=["status", "updated_at"])
            translation = existing
        else:
            try:
                with transaction.atomic():
                    translation = Translation.objects.create(
                        **lookup, source_text=text, requested_by=user
                    )
            except IntegrityError:  # requête concurrente sur le même texte
                return Translation.objects.get(**lookup)
        transaction.on_commit(lambda: ai_translate.delay(str(translation.id)))
    return translation


def store_result(*, translation_id, result: str | None) -> None:
    status = Translation.Status.READY if result else Translation.Status.FAILED
    Translation.objects.filter(id=translation_id).update(status=status, result=result or "")
