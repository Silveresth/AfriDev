"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.permissions import ReadOnlyOrAuthenticated
from core.schema import CURSOR_PARAMETERS, paginated
from features.hubs import selectors as hub_selectors

from .. import news, selectors, services
from .serializers import (
    CommunitySerializer,
    LikeInputSerializer,
    NewsItemSerializer,
    PollVoteInputSerializer,
    PostInputSerializer,
    PostOutputSerializer,
    PostUpdateSerializer,
    VoteInputSerializer,
    present_posts,
)


def _get_post(post_id):
    post = selectors.get_post(post_id=post_id)
    if post is None:
        raise NotFound("Post introuvable.")
    return post


def _one(post, request):
    return present_posts([post], viewer=request.user)[0]


class FeedView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("kind", str, required=False),
            OpenApiParameter("author", str, required=False, description="UUID de l'auteur"),
            OpenApiParameter("tag", str, required=False),
            OpenApiParameter("hub", str, required=False, description="Slug ou UUID du hub"),
            OpenApiParameter(
                "sort",
                str,
                required=False,
                enum=list(selectors.SORTS),
                description="hot = populaires (défaut), new = nouveaux, top = mieux notés",
            ),
        ],
        responses=paginated(PostOutputSerializer),
        operation_id="feed_list",
    )
    def get(self, request):
        hub = request.query_params.get("hub")
        hub_id = hub_selectors.resolve_hub_id(value=hub) if hub else None
        posts = selectors.list_feed(
            kind=request.query_params.get("kind"),
            author_id=request.query_params.get("author"),
            tag=request.query_params.get("tag"),
            hub_id=hub_id,
        )
        if hub and hub_id is None:
            posts = posts.none()
        paginator = CursorPagination()
        paginator.ordering = selectors.SORTS.get(request.query_params.get("sort", "hot"), "-hot")
        page = paginator.paginate_queryset(posts, request)
        return paginator.get_paginated_response(present_posts(page, viewer=request.user))

    @extend_schema(request=PostInputSerializer, responses={201: PostOutputSerializer})
    def post(self, request):
        data = PostInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        post = services.create_post(author=request.user, post_id=values.pop("id", None), **values)
        return Response(_one(post, request), status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=PostOutputSerializer)
    def get(self, request, post_id):
        return Response(_one(_get_post(post_id), request))

    @extend_schema(request=PostUpdateSerializer, responses=PostOutputSerializer)
    def patch(self, request, post_id):
        data = PostUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        post = services.update_post(
            post=_get_post(post_id), user=request.user, **data.validated_data
        )
        return Response(_one(post, request))

    @extend_schema(responses={204: None})
    def delete(self, request, post_id):
        services.delete_post(post=_get_post(post_id), user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PollVoteView(APIView):
    @extend_schema(request=PollVoteInputSerializer, responses=PostOutputSerializer)
    def post(self, request, post_id):
        data = PollVoteInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        post = _get_post(post_id)
        services.vote_poll(post=post, user=request.user, **data.validated_data)
        return Response(_one(post, request))


class PostVoteView(APIView):
    @extend_schema(request=VoteInputSerializer, responses=PostOutputSerializer)
    def post(self, request, post_id):
        data = VoteInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        post = services.set_vote(post=_get_post(post_id), user=request.user, **data.validated_data)
        return Response(_one(post, request))


class PostLikeView(APIView):
    """Obsolète (app mobile) : préférer /vote/."""

    @extend_schema(request=LikeInputSerializer, responses=PostOutputSerializer, deprecated=True)
    def post(self, request, post_id):
        data = LikeInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        post = services.set_like(post=_get_post(post_id), user=request.user, **data.validated_data)
        return Response(_one(post, request))


class CommunitiesView(APIView):
    """Communautés actives (tags) des 90 derniers jours : menu latéral et page d'accueil."""

    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        operation_id="feed_communities",
        parameters=[OpenApiParameter("limit", int, required=False)],
        responses=CommunitySerializer(many=True),
    )
    def get(self, request):
        try:
            limit = max(1, min(int(request.query_params.get("limit", 12)), 50))
        except ValueError:
            limit = 12
        since = timezone.now() - timedelta(days=90)
        return Response(
            CommunitySerializer(selectors.communities(since=since, limit=limit), many=True).data
        )


class TechNewsView(APIView):
    """Actu tech externe (Hacker News, DEV.to, médias RSS), la plus récente d'abord."""

    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        operation_id="feed_news",
        parameters=[
            OpenApiParameter("source", str, required=False, enum=list(news.SOURCES)),
            OpenApiParameter(
                "lang", str, required=False, enum=["fr", "en"], description="Langue des médias"
            ),
            OpenApiParameter("q", str, required=False, description="Recherche plein texte"),
        ],
        responses=NewsItemSerializer(many=True),
    )
    def get(self, request):
        rows = news.tech_news(
            source=request.query_params.get("source", "all"),
            lang=request.query_params.get("lang", ""),
            q=request.query_params.get("q", ""),
        )
        return Response(NewsItemSerializer(rows, many=True).data)


class HubFeedView(APIView):
    """Fil d'un hub : GET /api/hubs/<slug>/feed/ (routé dans config/urls.py)."""

    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(
        parameters=[
            *CURSOR_PARAMETERS,
            OpenApiParameter("kind", str, required=False),
            OpenApiParameter("sort", str, required=False, enum=list(selectors.SORTS)),
        ],
        responses=paginated(PostOutputSerializer),
        operation_id="hubs_feed",
    )
    def get(self, request, slug):
        hub = hub_selectors.get_hub_by_slug(slug=slug)
        if hub is None:
            raise NotFound("Hub introuvable.")
        posts = selectors.list_feed(kind=request.query_params.get("kind"), hub_id=hub.id)
        paginator = CursorPagination()
        paginator.ordering = selectors.SORTS.get(request.query_params.get("sort", "hot"), "-hot")
        page = paginator.paginate_queryset(posts, request)
        return paginator.get_paginated_response(present_posts(page, viewer=request.user))
