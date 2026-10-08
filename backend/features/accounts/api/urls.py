from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AccessTokenDetailView,
    AccessTokenListCreateView,
    DataExportView,
    LoginView,
    MeView,
    MFALoginView,
    OAuthCallbackView,
    OAuthLoginView,
    OAuthProvidersView,
    OAuthStartView,
    OTPRequestView,
    OTPVerifyView,
    RegisterView,
    RevokeOtherSessionsView,
    SessionDetailView,
    SessionListView,
    TOTPDisableView,
    TOTPEnableView,
    TOTPSetupView,
)

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    # « providers » avant « <provider> » : sinon il serait pris pour un nom de fournisseur.
    path("oauth/providers/", OAuthProvidersView.as_view(), name="oauth-providers"),
    path("oauth/<str:provider>/start/", OAuthStartView.as_view(), name="oauth-start"),
    path("oauth/<str:provider>/callback/", OAuthCallbackView.as_view(), name="oauth-callback"),
    path("oauth/<str:provider>/", OAuthLoginView.as_view(), name="oauth"),
    path("me/", MeView.as_view(), name="me"),
    path("me/export/", DataExportView.as_view(), name="export"),
    path("login/2fa/", MFALoginView.as_view(), name="login-2fa"),
    path("2fa/setup/", TOTPSetupView.as_view(), name="2fa-setup"),
    path("2fa/enable/", TOTPEnableView.as_view(), name="2fa-enable"),
    path("2fa/disable/", TOTPDisableView.as_view(), name="2fa-disable"),
    path("sessions/", SessionListView.as_view(), name="sessions"),
    path("sessions/revoke-others/", RevokeOtherSessionsView.as_view(), name="sessions-revoke"),
    path("sessions/<uuid:session_id>/", SessionDetailView.as_view(), name="session"),
    path("tokens/", AccessTokenListCreateView.as_view(), name="tokens"),
    path("tokens/<uuid:token_id>/", AccessTokenDetailView.as_view(), name="token"),
]
