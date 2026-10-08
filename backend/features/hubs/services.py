"""Écritures (création, adhésion, modération). Seul point d'entrée en écriture."""

import re

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils.text import slugify

from core.exceptions import ConflictError, DomainError, NotFoundError, PermissionDeniedError

from .events import hub_joined
from .models import Hub, HubMembership

SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")
EDITABLE_FIELDS = ("name", "description", "icon", "banner_url", "rules", "target_country")


def _clean_rules(rules) -> list[str]:
    cleaned = [str(rule).strip()[:200] for rule in (rules or []) if str(rule).strip()]
    if len(cleaned) > 10:
        raise DomainError("Un hub compte au plus 10 règles.", code="invalid_hub")
    return cleaned


def _clean_slug(slug: str, name: str) -> str:
    slug = (slug or slugify(name))[:40].strip("-")
    if not SLUG_RE.match(slug):
        raise DomainError(
            "L'adresse du hub : 3 à 40 caractères, lettres minuscules, chiffres et tirets.",
            code="invalid_slug",
        )
    return slug


def _is_moderator(hub: Hub, user) -> bool:
    if user.is_staff or hub.creator_id == user.id:
        return True
    return HubMembership.objects.filter(
        hub=hub, user=user, role=HubMembership.Role.MODERATOR
    ).exists()


@transaction.atomic
def create_hub(
    *,
    creator,
    name: str,
    slug: str = "",
    description: str = "",
    icon: str = "",
    banner_url: str = "",
    rules: list | None = None,
    target_country: str = "",
) -> Hub:
    name = name.strip()
    if len(name) < 2:
        raise DomainError("Le hub a besoin d'un nom.", code="invalid_hub")
    slug = _clean_slug(slug.strip().lower(), name)
    if Hub.objects.filter(slug=slug).exists():
        raise ConflictError(f"L'adresse h/{slug} est déjà prise.", code="slug_taken")
    hub = Hub(
        name=name[:60],
        slug=slug,
        description=description.strip()[:500],
        icon=icon.strip()[:300],
        banner_url=banner_url.strip(),
        rules=_clean_rules(rules),
        creator=creator,
        target_country=target_country.strip()[:60],
        member_count=1,
    )
    try:
        with transaction.atomic():
            hub.save()
    except IntegrityError as exc:  # course entre deux créations du même slug
        raise ConflictError(f"L'adresse h/{slug} est déjà prise.", code="slug_taken") from exc
    HubMembership.objects.create(hub=hub, user=creator, role=HubMembership.Role.MODERATOR)
    return hub


@transaction.atomic
def update_hub(*, hub: Hub, user, **fields) -> Hub:
    if not _is_moderator(hub, user):
        raise PermissionDeniedError("Seuls les modérateurs du hub peuvent le modifier.")
    changed = []
    for name in EDITABLE_FIELDS:
        if name not in fields or fields[name] is None:
            continue
        value = fields[name]
        value = _clean_rules(value) if name == "rules" else str(value).strip()
        if name == "name" and len(value) < 2:
            raise DomainError("Le hub a besoin d'un nom.", code="invalid_hub")
        if getattr(hub, name) != value:
            setattr(hub, name, value)
            changed.append(name)
    if changed:
        hub.save(update_fields=[*changed, "updated_at"])
    return hub


def set_verified(*, hub: Hub, user, verified: bool) -> Hub:
    if not user.is_staff:
        raise PermissionDeniedError("Seule l'équipe AfriDev peut certifier un hub.")
    hub.is_verified = verified
    hub.save(update_fields=["is_verified", "updated_at"])
    return hub


@transaction.atomic
def join_hub(*, hub: Hub, user) -> HubMembership:
    """Idempotent : rejoindre deux fois ne change rien."""
    membership, created = HubMembership.objects.get_or_create(hub=hub, user=user)
    if created:
        Hub.objects.filter(id=hub.id).update(member_count=F("member_count") + 1)
        hub.refresh_from_db(fields=["member_count"])
        transaction.on_commit(lambda: hub_joined.send(sender=Hub, hub_id=hub.id, user_id=user.id))
    return membership


@transaction.atomic
def leave_hub(*, hub: Hub, user) -> None:
    if hub.creator_id == user.id:
        raise DomainError("Le créateur ne peut pas quitter son hub.", code="creator_cannot_leave")
    deleted, _ = HubMembership.objects.filter(hub=hub, user=user).delete()
    if deleted:
        Hub.objects.filter(id=hub.id, member_count__gt=0).update(member_count=F("member_count") - 1)
        hub.refresh_from_db(fields=["member_count"])


def delete_hub(*, hub: Hub, user) -> None:
    if not (user.is_staff or hub.creator_id == user.id):
        raise PermissionDeniedError("Seul le créateur du hub peut le supprimer.")
    hub.soft_delete()


def require_hub(*, hub_id):
    """Pour feed / qa / snippets : vérifie qu'un hub existe avant d'y rattacher un contenu."""
    if not hub_id:
        return None
    if not Hub.objects.alive().filter(id=hub_id).exists():
        raise NotFoundError("Hub introuvable.", code="hub_not_found")
    return hub_id
