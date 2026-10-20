from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import NotFoundError
from core.serializers import ReadOnlyModelSerializer

from .. import security
from ..models import User


class UserSerializer(ReadOnlyModelSerializer):
    two_factor_enabled = serializers.BooleanField(read_only=True)
    email_verified = serializers.SerializerMethodField(help_text="Adresse e-mail confirmée.")
    has_password = serializers.SerializerMethodField(
        help_text="Faux pour un compte GitHub / Google : la suppression demande le pseudo."
    )

    class Meta:
        model = User
        # is_staff / is_superuser : le web n'affiche l'accès au back-office qu'à l'équipe.
        fields = [
            "id",
            "username",
            "email",
            "phone_number",
            "date_joined",
            "is_staff",
            "is_superuser",
            "two_factor_enabled",
            "email_verified",
            "has_password",
        ]

    def get_email_verified(self, user) -> bool:
        return user.email_verified_at is not None

    def get_has_password(self, user) -> bool:
        return user.has_usable_password()


class TokensSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class AuthResponseSerializer(serializers.Serializer):
    """Avec la double authentification : user et tokens sont null, mfa_required vaut true et
    mfa_token s'échange contre les jetons via POST /api/accounts/login/2fa/."""

    user = UserSerializer(allow_null=True)
    tokens = TokensSerializer(allow_null=True)
    created = serializers.BooleanField()
    mfa_required = serializers.BooleanField()
    mfa_token = serializers.CharField(allow_null=True)


class MFALoginInputSerializer(serializers.Serializer):
    mfa_token = serializers.CharField()
    code = serializers.RegexField(r"^\d{6}$")


class TOTPCodeSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$")


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(
        required=False, allow_blank=True, default="", help_text="Comptes avec mot de passe."
    )
    confirm = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Nom d'utilisateur retapé (comptes sans mot de passe : GitHub, Google).",
    )


class TOTPSetupSerializer(serializers.Serializer):
    secret = serializers.CharField(help_text="À saisir à la main si le QR code ne passe pas.")
    otpauth_url = serializers.CharField()
    qr_svg = serializers.CharField()


class SessionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    device = serializers.CharField()
    user_agent = serializers.CharField()
    ip_address = serializers.CharField()
    created_at = serializers.DateTimeField()
    last_used_at = serializers.DateTimeField(allow_null=True)
    current = serializers.BooleanField()


def present_sessions(sessions, *, current_sid) -> list[dict]:
    return [
        {
            "id": s.id,
            "device": security.describe_device(s.user_agent),
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "created_at": s.created_at,
            "last_used_at": s.last_used_at,
            "current": str(s.id) == str(current_sid),
        }
        for s in sessions
    ]


class RevokedCountSerializer(serializers.Serializer):
    revoked = serializers.IntegerField()


class AccessTokenInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    read_only = serializers.BooleanField(required=False, default=True)
    expires_in_days = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=365
    )


class AccessTokenSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    prefix = serializers.CharField()
    read_only = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    last_used_at = serializers.DateTimeField(allow_null=True)
    expires_at = serializers.DateTimeField(allow_null=True)


class CreatedAccessTokenSerializer(AccessTokenSerializer):
    token = serializers.CharField(help_text="Valeur complète, affichée une seule fois.")


def present_token(token, raw: str | None = None) -> dict:
    data = {
        "id": token.id,
        "name": token.name,
        "prefix": token.prefix,
        "read_only": token.read_only,
        "created_at": token.created_at,
        "last_used_at": token.last_used_at,
        "expires_at": token.expires_at,
    }
    if raw:
        data["token"] = raw
    return data


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """Renouvellement des jetons : refusé si la session (claim « sid ») a été révoquée."""

    def validate(self, attrs):
        sid = RefreshToken(attrs["refresh"]).get("sid")
        if sid:
            try:
                security.touch_session(sid=sid, request=self.context.get("request"))
            except NotFoundError as exc:
                raise InvalidToken("Session révoquée.") from exc
        return super().validate(attrs)


class RegisterInputSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True)


class LoginInputSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="Nom d'utilisateur ou e-mail.")
    password = serializers.CharField(write_only=True)


class EmailVerifyInputSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=500)


class LogoutInputSerializer(serializers.Serializer):
    # Appli : jeton de renouvellement de la session à fermer (le site l'envoie en cookie).
    refresh = serializers.CharField(required=False, allow_blank=True)


class OAuthInputSerializer(serializers.Serializer):
    code = serializers.CharField()
    redirect_uri = serializers.URLField(required=False)
    # Appli : le secret envoyé au démarrage (/oauth/<provider>/start/?code_verifier=…).
    code_verifier = serializers.CharField(required=False, allow_blank=True, max_length=128)


class UsernameStatusSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    reason = serializers.CharField(allow_blank=True)
    suggestion = serializers.CharField(allow_blank=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    password = serializers.CharField(write_only=True, min_length=8)


class PasswordResetCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        r"^\s*\d{6}\s*$", error_messages={"invalid": "Le code a 6 chiffres."}
    )
    password = serializers.CharField(write_only=True, min_length=8)


class OAuthProvidersSerializer(serializers.Serializer):
    providers = serializers.ListField(child=serializers.ChoiceField(["github", "google", "gitlab"]))
