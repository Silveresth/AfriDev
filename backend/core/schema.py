"""Aides de documentation OpenAPI (drf-spectacular) partagées par les features.

Les vues sont des APIView : spectacular ne voit pas la pagination par curseur,
on décrit donc explicitement la forme {next, previous, results} et le paramètre `cursor`.
"""

from functools import cache

from drf_spectacular.utils import OpenApiParameter, inline_serializer
from rest_framework import serializers

CURSOR_PARAMETERS = [
    OpenApiParameter("cursor", str, required=False, description="Curseur de la page suivante"),
    OpenApiParameter("page_size", int, required=False, description="20 par défaut, 50 maximum"),
]


@cache
def paginated(serializer_class):
    """Une seule enveloppe par sérialiseur : deux vues peuvent paginer la même forme."""
    name = serializer_class.__name__.removesuffix("Serializer")
    return inline_serializer(
        name=f"Paginated{name}List",
        fields={
            "next": serializers.URLField(allow_null=True),
            "previous": serializers.URLField(allow_null=True),
            "results": serializer_class(many=True),
        },
    )
