"""Vues minces : valident l'entrée, puis appellent services / selectors."""

from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from django.utils.html import escape
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.throttling import OTPThrottle

from .. import oauth, security, services
from ..authentication import NotPersonalAccessToken
from ..export import export_user_data
from .serializers import (
    AccessTokenInputSerializer,
    AccessTokenSerializer,
    AuthResponseSerializer,
    CreatedAccessTokenSerializer,
    LoginInputSerializer,
    MFALoginInputSerializer,
    OAuthInputSerializer,
    OAuthProvidersSerializer,
    OTPRequestInputSerializer,
    OTPRequestOutputSerializer,
    OTPVerifyInputSerializer,
    RegisterInputSerializer,
    RevokedCountSerializer,
    SessionSerializer,
    TOTPCodeSerializer,
    TOTPSetupSerializer,
    UserSerializer,
    present_sessions,
    present_token,
)


def _auth_response(
    request, user, *, created: bool, status_code=status.HTTP_200_OK, mfa_done: bool = False
) -> Response:
    if user.two_factor_enabled and not mfa_done:
        # Mot de passe (ou SMS, OAuth) validé : reste le code de l'application d'authentification.
        services.ensure_active(user)
        payload = {
            "user": None,
            "tokens": None,
            "created": created,
            "mfa_required": True,
            "mfa_token": security.mfa_challenge(user=user),
        }
        return Response(payload, status=status_code)
    payload = {
        "user": UserSerializer(user).data,
        "tokens": services.issue_tokens(user, request=request),
        "created": created,
        "mfa_required": False,
        "mfa_token": None,
    }
    return Response(payload, status=status_code)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterInputSerializer, responses={201: AuthResponseSerializer})
    def post(self, request):
        data = RegisterInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = services.register_user(**data.validated_data)
        return _auth_response(request, user, created=True, status_code=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=LoginInputSerializer, responses=AuthResponseSerializer)
    def post(self, request):
        data = LoginInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = services.authenticate_user(**data.validated_data)
        return _auth_response(request, user, created=False)


class OTPRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPThrottle]

    @extend_schema(request=OTPRequestInputSerializer, responses={202: OTPRequestOutputSerializer})
    def post(self, request):
        data = OTPRequestInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        phone = services.request_phone_otp(**data.validated_data)
        return Response(
            {"phone_number": phone, "expires_in": settings.OTP_TTL_SECONDS},
            status=status.HTTP_202_ACCEPTED,
        )


class OTPVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OTPThrottle]

    @extend_schema(request=OTPVerifyInputSerializer, responses=AuthResponseSerializer)
    def post(self, request):
        data = OTPVerifyInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user, created = services.login_with_phone(**data.validated_data)
        return _auth_response(request, user, created=created)


class OAuthLoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=OAuthInputSerializer, responses=AuthResponseSerializer)
    def post(self, request, provider):
        data = OAuthInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user, created = services.login_with_oauth(provider=provider, **data.validated_data)
        return _auth_response(request, user, created=created)


def _oauth_callback_url(request, provider: str) -> str:
    path = reverse("accounts:oauth-callback", kwargs={"provider": provider})
    if settings.API_PUBLIC_URL:
        return f"{settings.API_PUBLIC_URL.rstrip('/')}{path}"
    return request.build_absolute_uri(path)


class OAuthProvidersView(APIView):
    """Fournisseurs OAuth actifs : l'appli n'affiche que les boutons utilisables."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OAuthProvidersSerializer)
    def get(self, request):
        return Response({"providers": oauth.configured_providers()})


class OAuthStartView(APIView):
    """Appli mobile : redirige vers GitHub / Google ; le retour passe par OAuthCallbackView."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        parameters=[OpenApiParameter("return_to", str, required=True)],
        responses={302: None},
    )
    def get(self, request, provider):
        url = oauth.authorize_url(
            provider,
            callback_url=_oauth_callback_url(request, provider),
            return_to=request.query_params.get("return_to", ""),
        )
        return HttpResponseRedirect(url)


class OAuthCallbackView(APIView):
    """Rebond : le fournisseur revient ici, on renvoie le code à l'appli (afridev:// ou exp://).

    L'appli échange ensuite le code via POST /oauth/<provider>/ avec ce même redirect_uri.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(exclude=True)
    def get(self, request, provider):
        params = request.query_params
        try:
            if params.get("error") or not params.get("code"):
                reason = params.get("error_description") or params.get("error") or "annulée"
                target = oauth.app_return_url(
                    provider, state=params.get("state", ""), params={"error": reason}
                )
            else:
                target = oauth.app_return_url(
                    provider,
                    state=params.get("state", ""),
                    params={
                        "code": params["code"],
                        "redirect_uri": _oauth_callback_url(request, provider),
                    },
                )
        except oauth.OAuthError as exc:
            return HttpResponse(
                f"<p style='font-family:sans-serif;padding:24px'>{escape(exc.message)}</p>",
                status=400,
            )
        # HttpResponseRedirect refuse les schémas non web (exp://, afridev://).
        response = HttpResponse(status=302)
        response["Location"] = target
        return response


class MeView(APIView):
    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class MFALoginView(APIView):
    """Deuxième étape de la connexion : le code à 6 chiffres de l'application."""

    permission_classes = [AllowAny]
    throttle_classes = [OTPThrottle]

    @extend_schema(request=MFALoginInputSerializer, responses=AuthResponseSerializer)
    def post(self, request):
        data = MFALoginInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = security.complete_mfa(**data.validated_data)
        return _auth_response(request, user, created=False, mfa_done=True)


class TOTPSetupView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(request=None, responses=TOTPSetupSerializer)
    def post(self, request):
        return Response(security.start_totp_setup(user=request.user))


class TOTPEnableView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(request=TOTPCodeSerializer, responses=UserSerializer)
    def post(self, request):
        data = TOTPCodeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = security.enable_totp(user=request.user, **data.validated_data)
        return Response(UserSerializer(user).data)


class TOTPDisableView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(request=TOTPCodeSerializer, responses=UserSerializer)
    def post(self, request):
        data = TOTPCodeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = security.disable_totp(user=request.user, **data.validated_data)
        return Response(UserSerializer(user).data)


def _current_sid(request):
    token = request.auth
    return token.get("sid") if hasattr(token, "get") else None


class SessionListView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(responses=SessionSerializer(many=True))
    def get(self, request):
        sessions = security.list_sessions(user=request.user)
        return Response(present_sessions(sessions, current_sid=_current_sid(request)))


class SessionDetailView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(responses={204: None})
    def delete(self, request, session_id):
        security.revoke_session(user=request.user, session_id=session_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RevokeOtherSessionsView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(request=None, responses=RevokedCountSerializer)
    def post(self, request):
        revoked = security.revoke_other_sessions(
            user=request.user, current_sid=_current_sid(request)
        )
        return Response({"revoked": revoked})


class AccessTokenListCreateView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(responses=AccessTokenSerializer(many=True))
    def get(self, request):
        return Response([present_token(t) for t in security.list_access_tokens(user=request.user)])

    @extend_schema(
        request=AccessTokenInputSerializer, responses={201: CreatedAccessTokenSerializer}
    )
    def post(self, request):
        data = AccessTokenInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        token, raw = security.create_access_token(user=request.user, **data.validated_data)
        return Response(present_token(token, raw), status=status.HTTP_201_CREATED)


class AccessTokenDetailView(APIView):
    permission_classes = [NotPersonalAccessToken]

    @extend_schema(responses={204: None})
    def delete(self, request, token_id):
        security.revoke_access_token(user=request.user, token_id=token_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DataExportView(APIView):
    """Toutes mes données en JSON (téléchargement)."""

    permission_classes = [NotPersonalAccessToken]

    @extend_schema(responses={(200, "application/json"): OpenApiTypes.OBJECT})
    def get(self, request):
        response = Response(export_user_data(user=request.user))
        filename = f"afridev-{request.user.username}-{timezone.now():%Y-%m-%d}.json"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "no-store"
        return response
