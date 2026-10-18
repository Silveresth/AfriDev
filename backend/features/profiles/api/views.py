"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import CursorPagination
from core.permissions import ReadOnlyOrAuthenticated
from core.schema import CURSOR_PARAMETERS, paginated
from core.throttling import AIQuotaThrottle
from features.hubs import selectors as hub_selectors

from .. import selectors, services
from ..qr import profile_qr_svg
from .serializers import (
    EndorsementInputSerializer,
    EndorsementSerializer,
    FollowListItemSerializer,
    FollowStateSerializer,
    GitHubOverviewSerializer,
    MyProfileSerializer,
    OnboardingSerializer,
    OnboardingSuggestionsSerializer,
    PeopleSearchItemSerializer,
    PinnedInputSerializer,
    PreferencesInputSerializer,
    ProfileUpdateSerializer,
    PublicProfileSerializer,
    present_endorsements,
    present_follow_page,
    present_onboarding,
    present_people,
)


def _my_profile(request):
    profile = selectors.get_profile_for_user(user_id=request.user.id)
    if profile is None:
        raise NotFound("Profil introuvable.")
    return profile


def _public_profile(username):
    profile = selectors.get_profile_by_username(username=username)
    if profile is None:
        raise NotFound("Profil introuvable.")
    return profile


class MyProfileView(APIView):
    @extend_schema(responses=MyProfileSerializer)
    def get(self, request):
        profile = _my_profile(request)
        return Response(MyProfileSerializer(profile, context={"request": request}).data)

    @extend_schema(request=ProfileUpdateSerializer, responses=MyProfileSerializer)
    def patch(self, request):
        data = ProfileUpdateSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        profile = services.update_profile(profile=_my_profile(request), **data.validated_data)
        return Response(MyProfileSerializer(profile, context={"request": request}).data)


class MyPinnedView(APIView):
    """Remplace la liste des contenus épinglés (3 au plus, dans l'ordre donné)."""

    @extend_schema(request=PinnedInputSerializer, responses=MyProfileSerializer)
    def put(self, request):
        data = PinnedInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        profile = services.set_pinned(
            profile=_my_profile(request), items=data.validated_data["items"]
        )
        return Response(MyProfileSerializer(profile, context={"request": request}).data)


class MyOnboardingView(APIView):
    """Catalogue de l'écran d'accueil (niveaux, objectifs, thématiques) et choix actuels."""

    @extend_schema(responses=OnboardingSerializer)
    def get(self, request):
        return Response(present_onboarding(_my_profile(request)))


class MyPreferencesView(APIView):
    """Enregistre les préférences de l'accueil (modifiables ensuite depuis les réglages)."""

    @extend_schema(request=PreferencesInputSerializer, responses=MyProfileSerializer)
    def put(self, request):
        data = PreferencesInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        profile = services.save_preferences(profile=_my_profile(request), **data.validated_data)
        return Response(MyProfileSerializer(profile, context={"request": request}).data)


class MyOnboardingSkipView(APIView):
    @extend_schema(request=None, responses=MyProfileSerializer)
    def post(self, request):
        profile = services.skip_onboarding(profile=_my_profile(request))
        return Response(MyProfileSerializer(profile, context={"request": request}).data)


class PeopleSearchView(APIView):
    """Recherche de comptes (Explorer, @mentions) : ?q=ami&limit=8."""

    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="profiles_search",
        parameters=[
            OpenApiParameter("q", str, required=True),
            OpenApiParameter("limit", int, required=False),
        ],
        responses=PeopleSearchItemSerializer(many=True),
    )
    def get(self, request):
        viewer = request.user if request.user.is_authenticated else None
        try:
            limit = int(request.query_params.get("limit", 20))
        except ValueError:
            limit = 20
        profiles = selectors.search_people(
            query=request.query_params.get("q", ""),
            viewer_id=viewer.id if viewer else None,
            limit=limit,
        )
        return Response(present_people(profiles, viewer=viewer))


class MySuggestionsView(APIView):
    """Membres à suivre et hubs à rejoindre d'après des tags (dernière étape de l'accueil)."""

    @extend_schema(
        parameters=[OpenApiParameter("tags", str, description="Tags séparés par des virgules")],
        responses=OnboardingSuggestionsSerializer,
    )
    def get(self, request):
        tags = [tag for tag in request.query_params.get("tags", "").split(",") if tag][:20]
        if not tags:
            tags = list(_my_profile(request).interests)
        return Response(
            {
                "people": selectors.suggested_people(user_id=request.user.id, tags=tags),
                "hubs": hub_selectors.suggested_hubs(tags=tags, user_id=request.user.id),
            }
        )


class AIBioView(APIView):
    throttle_classes = [AIQuotaThrottle]

    @extend_schema(request=None, responses={202: MyProfileSerializer})
    def post(self, request):
        profile = services.request_ai_bio(profile=_my_profile(request))
        return Response(MyProfileSerializer(profile).data, status=status.HTTP_202_ACCEPTED)


class PublicProfileView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=PublicProfileSerializer)
    def get(self, request, username):
        profile = _public_profile(username)
        return Response(PublicProfileSerializer(profile, context={"request": request}).data)


class ProfileGitHubView(APIView):
    """Dépôts, étoiles et langages du compte GitHub lié (cache 6 h) ; 404 s'il n'y en a pas."""

    permission_classes = [AllowAny]

    @extend_schema(responses=GitHubOverviewSerializer)
    def get(self, request, username):
        overview = selectors.github_overview(profile=_public_profile(username))
        if overview is None:
            raise NotFound("Aucune donnée GitHub pour ce profil.")
        return Response(overview)


class ProfileEndorsementsView(APIView):
    """GET : compétences endossées ; POST / DELETE {skill} : endosser ou retirer son +1."""

    permission_classes = [ReadOnlyOrAuthenticated]

    @extend_schema(responses=EndorsementSerializer(many=True))
    def get(self, request, username):
        profile = _public_profile(username)
        return Response(present_endorsements(profile, viewer=request.user))

    @extend_schema(request=EndorsementInputSerializer, responses=EndorsementSerializer(many=True))
    def post(self, request, username):
        data = EndorsementInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        profile = _public_profile(username)
        services.endorse(endorsee=profile, endorser=request.user, **data.validated_data)
        return Response(present_endorsements(profile, viewer=request.user))

    @extend_schema(
        parameters=[OpenApiParameter("skill", str, required=True)],
        responses=EndorsementSerializer(many=True),
    )
    def delete(self, request, username):
        data = EndorsementInputSerializer(data=request.query_params)
        data.is_valid(raise_exception=True)
        profile = _public_profile(username)
        services.withdraw_endorsement(
            endorsee=profile, endorser=request.user, **data.validated_data
        )
        return Response(present_endorsements(profile, viewer=request.user))


def _follow_state(profile, *, viewer) -> dict:
    profile.refresh_from_db(fields=["followers_count", "following_count"])
    return {
        "is_following": selectors.is_following(follower_id=viewer.id, followed_id=profile.user_id),
        "followers_count": profile.followers_count,
        "following_count": profile.following_count,
    }


class ProfileFollowView(APIView):
    """Suivre un membre (idempotent)."""

    @extend_schema(request=None, responses=FollowStateSerializer)
    def post(self, request, username):
        profile = _public_profile(username)
        services.follow(follower=request.user, followed=profile)
        return Response(_follow_state(profile, viewer=request.user))


class ProfileUnfollowView(APIView):
    """Ne plus suivre un membre (idempotent)."""

    @extend_schema(request=None, responses=FollowStateSerializer)
    def post(self, request, username):
        profile = _public_profile(username)
        services.unfollow(follower=request.user, followed=profile)
        return Response(_follow_state(profile, viewer=request.user))


class _FollowListView(APIView):
    permission_classes = [AllowAny]
    list_selector = None
    user_field = ""

    def get(self, request, username):
        profile = _public_profile(username)
        paginator = CursorPagination()
        page = paginator.paginate_queryset(self.list_selector(user_id=profile.user_id), request)
        rows = present_follow_page(page, user_field=self.user_field, viewer=request.user)
        return paginator.get_paginated_response(FollowListItemSerializer(rows, many=True).data)


@extend_schema(parameters=CURSOR_PARAMETERS, responses=paginated(FollowListItemSerializer))
class ProfileFollowersView(_FollowListView):
    list_selector = staticmethod(selectors.list_followers)
    user_field = "follower_id"


@extend_schema(parameters=CURSOR_PARAMETERS, responses=paginated(FollowListItemSerializer))
class ProfileFollowingView(_FollowListView):
    list_selector = staticmethod(selectors.list_following)
    user_field = "followed_id"


class ProfileQRCodeView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={(200, "image/svg+xml"): OpenApiTypes.BINARY})
    def get(self, request, username):
        profile = _public_profile(username)
        response = HttpResponse(profile_qr_svg(profile.username), content_type="image/svg+xml")
        response["Cache-Control"] = "public, max-age=86400"
        return response
