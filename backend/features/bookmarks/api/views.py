"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.schema import CURSOR_PARAMETERS, paginated

from .. import selectors, services
from .serializers import (
    CollectionInputSerializer,
    CollectionOutputSerializer,
    CollectionUpdateSerializer,
    ItemInputSerializer,
    ItemOutputSerializer,
    SavedTargetSerializer,
    present_collections,
    present_items,
)


def _collection(request, collection_id, *, write: bool = False):
    """Lecture : la sienne ou une collection publique ; écriture : la sienne seulement."""
    collection = selectors.get_collection(collection_id=collection_id)
    if collection is None:
        raise NotFound("Collection introuvable.")
    mine = collection.owner_id == request.user.id
    if not mine and (write or collection.is_private):
        raise NotFound("Collection introuvable.")
    return collection


class CollectionListCreateView(APIView):
    @extend_schema(responses=CollectionOutputSerializer(many=True))
    def get(self, request):
        collections = selectors.list_collections(owner_id=request.user.id)
        return Response(present_collections(collections))

    @extend_schema(request=CollectionInputSerializer, responses={201: CollectionOutputSerializer})
    def post(self, request):
        data = CollectionInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        collection = services.create_collection(owner=request.user, **data.validated_data)
        fresh = selectors.get_collection(collection_id=collection.id)
        return Response(present_collections([fresh])[0], status=status.HTTP_201_CREATED)


class CollectionDetailView(APIView):
    @extend_schema(responses=CollectionOutputSerializer)
    def get(self, request, collection_id):
        return Response(present_collections([_collection(request, collection_id)])[0])

    @extend_schema(request=CollectionUpdateSerializer, responses=CollectionOutputSerializer)
    def patch(self, request, collection_id):
        data = CollectionUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        collection = services.update_collection(
            collection=_collection(request, collection_id, write=True),
            user=request.user,
            **data.validated_data,
        )
        return Response(present_collections([collection])[0])

    @extend_schema(responses={204: None})
    def delete(self, request, collection_id):
        services.delete_collection(
            collection=_collection(request, collection_id, write=True), user=request.user
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CollectionItemsView(APIView):
    @extend_schema(parameters=CURSOR_PARAMETERS, responses=paginated(ItemOutputSerializer))
    def get(self, request, collection_id):
        collection = _collection(request, collection_id)
        paginator = CursorPagination()
        page = paginator.paginate_queryset(
            selectors.list_items(collection_id=collection.id), request
        )
        return paginator.get_paginated_response(present_items(page, viewer=request.user))

    @extend_schema(request=ItemInputSerializer, responses={201: ItemOutputSerializer})
    def post(self, request, collection_id):
        data = ItemInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        item = services.add_item(
            collection=_collection(request, collection_id, write=True),
            user=request.user,
            **data.validated_data,
        )
        return Response(present_items([item], viewer=request.user)[0], status=201)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "target_type", str, required=True, enum=["post", "question", "snippet"]
            ),
            OpenApiParameter("target_id", str, required=True),
        ],
        responses={204: None},
    )
    def delete(self, request, collection_id):
        """Retire un contenu de la collection : ?target_type=post&target_id=<uuid>."""
        data = ItemInputSerializer(data=request.query_params)
        data.is_valid(raise_exception=True)
        services.remove_target(
            collection=_collection(request, collection_id, write=True),
            user=request.user,
            **data.validated_data,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemDetailView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, item_id):
        item = selectors.get_item(item_id=item_id)
        if item is None or item.owner_id != request.user.id:
            raise NotFound("Élément introuvable.")
        services.remove_item(item=item, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SavedTargetsView(APIView):
    """Tout ce que le membre a enregistré, avec les collections qui le contiennent."""

    @extend_schema(responses=SavedTargetSerializer(many=True))
    def get(self, request):
        return Response(selectors.saved_targets(owner_id=request.user.id))


class QuickSaveView(APIView):
    """Enregistrement en un geste (sans choisir de collection) : dans la collection par défaut."""

    @extend_schema(request=ItemInputSerializer, responses={201: ItemOutputSerializer})
    def post(self, request):
        data = ItemInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        collection = services.ensure_default_collection(owner=request.user)
        item = services.add_item(collection=collection, user=request.user, **data.validated_data)
        return Response(present_items([item], viewer=request.user)[0], status=201)
