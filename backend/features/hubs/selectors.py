"""Lectures. Seul point d'entrée en lecture pour les autres features."""

import uuid

from django.db.models import Q, QuerySet

from .models import Hub, HubBan, HubMembership


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


def suggested_hubs(*, tags, user_id=None, limit: int = 6) -> list[dict]:
    """Hubs dont le nom, le slug ou la description évoque l'un des tags (les plus actifs
    d'abord), hors hubs déjà rejoints ; à défaut, les plus populaires."""
    hubs = Hub.objects.alive()
    if user_id:
        hubs = hubs.exclude(memberships__user_id=user_id)
    matching = Q()
    for tag in list(tags or [])[:12]:
        matching |= Q(slug__icontains=tag) | Q(name__icontains=tag) | Q(description__icontains=tag)
    picked = list(hubs.filter(matching).order_by("-member_count")[:limit]) if matching else []
    if len(picked) < limit:
        picked += list(
            hubs.exclude(id__in=[hub.id for hub in picked]).order_by("-member_count")[
                : limit - len(picked)
            ]
        )
    return [
        {
            "id": hub.id,
            "slug": hub.slug,
            "name": hub.name,
            "icon": hub.icon,
            "description": hub.description[:140],
            "member_count": hub.member_count,
            "is_verified": hub.is_verified,
        }
        for hub in picked
    ]


def get_hub_by_slug(*, slug: str) -> Hub | None:
    return Hub.objects.alive().filter(slug=slug.lower()).first()


def get_hub(*, hub_id, include_hidden: bool = False) -> Hub | None:
    hubs = Hub.objects.all() if include_hidden else Hub.objects.alive()
    return hubs.filter(id=hub_id).first()


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


def list_members(*, hub_id, query: str | None = None, role: str | None = None) -> QuerySet:
    """Adhésions d'un hub (gestion par la modération), filtrables par pseudo et par rôle."""
    members = HubMembership.objects.filter(hub_id=hub_id)
    if role in HubMembership.Role.values:
        members = members.filter(role=role)
    if query:
        members = members.filter(user__username__icontains=query.strip().lstrip("@"))
    return members


def list_bans(*, hub_id) -> QuerySet:
    return HubBan.objects.filter(hub_id=hub_id).order_by("-created_at")


def list_moderators(*, hub_id) -> list:
    return list(
        HubMembership.objects.filter(hub_id=hub_id, role=HubMembership.Role.MODERATOR)
        .order_by("created_at")
        .values_list("user_id", flat=True)
    )


def author_hub_roles(*, pairs: set[tuple]) -> dict:
    """pairs : {(hub_id, user_id), ...} -> {(hub_id, user_id): "creator" | "moderator"}."""
    clean_pairs = {(h, u) for h, u in pairs if h and u}
    if not clean_pairs:
        return {}
    hub_ids = {h for h, _ in clean_pairs}
    user_ids = {u for _, u in clean_pairs}
    creators = dict(Hub.objects.alive().filter(id__in=hub_ids).values_list("id", "creator_id"))
    mods = set(
        HubMembership.objects.filter(
            hub_id__in=hub_ids, user_id__in=user_ids, role=HubMembership.Role.MODERATOR
        ).values_list("hub_id", "user_id")
    )
    result = {}
    for hub_id, user_id in clean_pairs:
        if creators.get(hub_id) == user_id:
            result[(hub_id, user_id)] = "creator"
        elif (hub_id, user_id) in mods:
            result[(hub_id, user_id)] = "moderator"
    return result


def moderated_hub_ids(*, hub_ids, user) -> set:
    """Parmi `hub_ids`, ceux que l'utilisateur peut modérer (créateur, modérateur ou staff) :
    deux requêtes au plus, quel que soit le nombre de hubs (listes de posts, de snippets…)."""
    hub_ids = {hub_id for hub_id in hub_ids if hub_id}
    if not hub_ids or not user or not user.is_authenticated:
        return set()
    alive = set(Hub.objects.alive().filter(id__in=hub_ids).values_list("id", "creator_id"))
    if getattr(user, "is_staff", False):
        return {hub_id for hub_id, _ in alive}
    created = {hub_id for hub_id, creator_id in alive if creator_id == user.id}
    others = {hub_id for hub_id, _ in alive} - created
    if not others:
        return created
    return created | set(
        HubMembership.objects.filter(
            hub_id__in=others, user=user, role=HubMembership.Role.MODERATOR
        ).values_list("hub_id", flat=True)
    )


def is_hub_moderator(*, hub_id, user) -> bool:
    """Vérifie si l'utilisateur est créateur du hub, modérateur ou staff."""
    return hub_id in moderated_hub_ids(hub_ids={hub_id}, user=user)


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
