"""Lectures. Seul point d'entrée en lecture pour les autres features."""

import uuid

from django.db.models import Q, QuerySet

from .models import Hub, HubMembership


def list_hubs(
    *, query: str | None = None, country: str | None = None, member_id=None, verified=None
) -> QuerySet[Hub]:
    hubs = Hub.objects.alive()
    if query:
        hubs = hubs.filter(
            Q(name__icontains=query) | Q(slug__icontains=query) | Q(description__icontains=query)
        )
    if country:
        hubs = hubs.filter(target_country__iexact=country)
    if member_id:
        hubs = hubs.filter(memberships__user_id=member_id)
    if verified is not None:
        hubs = hubs.filter(is_verified=verified)
    return hubs


def get_hub_by_slug(*, slug: str) -> Hub | None:
    return Hub.objects.alive().filter(slug=slug.lower()).first()


def get_hub(*, hub_id) -> Hub | None:
    return Hub.objects.alive().filter(id=hub_id).first()


def resolve_hub_id(*, value: str | None):
    """Accepte un slug (« python-senegal ») ou un UUID ; None si inconnu."""
    if not value:
        return None
    try:
        hub = get_hub(hub_id=uuid.UUID(str(value)))
    except ValueError:
        hub = get_hub_by_slug(slug=str(value))
    return hub.id if hub else None


def hub_cards(*, hub_ids) -> dict:
    """{hub_id: {id, slug, name, icon, is_verified}} : le hub affiché sur un contenu."""
    ids = {hub_id for hub_id in hub_ids if hub_id}
    if not ids:
        return {}
    return {
        hub.id: {
            "id": hub.id,
            "slug": hub.slug,
            "name": hub.name,
            "icon": hub.icon,
            "is_verified": hub.is_verified,
        }
        for hub in Hub.objects.alive().filter(id__in=ids)
    }


def viewer_roles(*, hub_ids, user) -> dict:
    """{hub_id: "member" | "moderator"} pour le membre connecté."""
    if not user or not user.is_authenticated:
        return {}
    return dict(
        HubMembership.objects.filter(hub_id__in=hub_ids, user=user).values_list("hub_id", "role")
    )


def member_hub_ids(*, user_id) -> list:
    return list(HubMembership.objects.filter(user_id=user_id).values_list("hub_id", flat=True))


def list_moderators(*, hub_id) -> list:
    return list(
        HubMembership.objects.filter(hub_id=hub_id, role=HubMembership.Role.MODERATOR)
        .order_by("created_at")
        .values_list("user_id", flat=True)
    )


def export_for_user(*, user_id) -> dict:
    """Données personnelles (export RGPD) : hubs créés et adhésions."""
    return {
        "hubs_created": list(
            Hub.objects.filter(creator_id=user_id).values("slug", "name", "created_at")
        ),
        "hub_memberships": list(
            HubMembership.objects.filter(user_id=user_id).values("hub__slug", "role", "created_at")
        ),
    }
