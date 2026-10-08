"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import ReadOnlyOrAuthenticated
from core.throttling import AIQuotaThrottle

from .. import selectors, services
from ..qr import profile_qr_svg
from .serializers import (
    EndorsementInputSerializer,
    EndorsementSerializer,
    GitHubOverviewSerializer,
    MyProfileSerializer,
    PinnedInputSerializer,
    ProfileUpdateSerializer,
    PublicProfileSerializer,
    present_endorsements,
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


class ProfileQRCodeView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={(200, "image/svg+xml"): OpenApiTypes.BINARY})
    def get(self, request, username):
        profile = _public_profile(username)
        response = HttpResponse(profile_qr_svg(profile.username), content_type="image/svg+xml")
        response["Cache-Control"] = "public, max-age=86400"
        return response
