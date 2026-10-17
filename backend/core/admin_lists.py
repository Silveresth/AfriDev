"""Filtre commun des listes du back-office : contenus en ligne ou retirés, recherche texte."""

from django.db.models import Q, QuerySet


def admin_filter(
    queryset: QuerySet, *, removed: bool = False, query: str = "", fields=()
) -> QuerySet:
    queryset = queryset.filter(deleted_at__isnull=not removed)
    if query:
        condition = Q()
        for field in fields:
            condition |= Q(**{f"{field}__icontains": query})
        queryset = queryset.filter(condition)
    return queryset
