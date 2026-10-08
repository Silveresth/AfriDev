"""Sécurité du compte : sessions (appareils connectés), double authentification TOTP,
jetons d'accès personnels. Écritures et lectures de ces trois sujets."""

import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import DomainError, NotFoundError

from . import totp
from .authentication import TOKEN_PREFIX
from .models import PersonalAccessToken, User, UserSession

# ── Sessions ──

REVOKED_KEY = "accounts:revoked-session:{}"


def _client_info(request) -> tuple[str, str]:
    if request is None:
        return "", ""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
    return request.META.get("HTTP_USER_AGENT", "")[:300], ip[:45]


def start_session(*, user: User, request=None) -> dict:
    """Jetons d'une nouvelle session ; le claim « sid » la relie à l'appareil."""
    user_agent, ip = _client_info(request)
    session = UserSession.objects.create(
        user=user, user_agent=user_agent, ip_address=ip, last_used_at=timezone.now()
    )
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = str(session.id)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def is_session_revoked(sid: str) -> bool:
    """Vérifié à chaque requête : cache seulement (posé à la révocation), sans requête SQL."""
    return bool(cache.get(REVOKED_KEY.format(sid)))


def touch_session(*, sid: str, request=None) -> UserSession:
    """Au renouvellement des jetons : refuse une session révoquée, note la dernière activité."""
    session = UserSession.objects.filter(id=sid).first()
    if session is None or session.revoked_at is not None:
        raise NotFoundError("Session révoquée.", code="session_revoked")
    user_agent, ip = _client_info(request)
    session.last_used_at = timezone.now()
    if ip:
        session.ip_address = ip
    if user_agent:
        session.user_agent = user_agent
    session.save(update_fields=["last_used_at", "ip_address", "user_agent", "updated_at"])
    return session


def list_sessions(*, user: User):
    return UserSession.objects.filter(user=user, revoked_at__isnull=True).order_by(
        "-last_used_at", "-created_at"
    )


def _revoke(sessions) -> int:
    ttl = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()) + 60
    ids = list(sessions.values_list("id", flat=True))
    sessions.update(revoked_at=timezone.now())
    for sid in ids:
        cache.set(REVOKED_KEY.format(sid), True, ttl)
    return len(ids)


def revoke_session(*, user: User, session_id) -> None:
    sessions = UserSession.objects.filter(id=session_id, user=user, revoked_at__isnull=True)
    if not _revoke(sessions):
        raise NotFoundError("Session introuvable.")


def revoke_other_sessions(*, user: User, current_sid: str | None) -> int:
    sessions = UserSession.objects.filter(user=user, revoked_at__isnull=True)
    if current_sid:
        sessions = sessions.exclude(id=current_sid)
    return _revoke(sessions)


def describe_device(user_agent: str) -> str:
    """« Chrome · Windows », « Application mobile · Android »… (sans base de données d'UA)."""
    ua = user_agent or ""
    if not ua:
        return "Appareil inconnu"
    if re.search(r"okhttp|Expo|CFNetwork|Dalvik", ua):
        browser = "Application mobile"
    else:
        browser = next(
            (
                name
                for pattern, name in (
                    (r"Edg/", "Edge"),
                    (r"OPR/|Opera", "Opera"),
                    (r"Firefox/", "Firefox"),
                    (r"Chrome/", "Chrome"),
                    (r"Safari/", "Safari"),
                )
                if re.search(pattern, ua)
            ),
            "Navigateur",
        )
    system = next(
        (
            name
            for pattern, name in (
                (r"Android", "Android"),
                (r"iPhone|iPad|iOS", "iOS"),
                (r"Windows", "Windows"),
                (r"Mac OS X|Macintosh", "macOS"),
                (r"Linux", "Linux"),
            )
            if re.search(pattern, ua)
        ),
        "",
    )
    return f"{browser} · {system}" if system else browser


# ── Double authentification (TOTP) ──

MFA_SALT = "afridev.accounts.mfa"
MFA_MAX_AGE = 300  # secondes pour saisir le code après le mot de passe


class InvalidTOTPError(DomainError):
    code = "invalid_totp"


def _check_code(user: User, code: str) -> None:
    step = totp.matching_step(user.totp_secret, code)
    if step is None or step <= user.totp_last_step:
        raise InvalidTOTPError("Code invalide ou déjà utilisé.")
    user.totp_last_step = step
    user.save(update_fields=["totp_last_step"])


@transaction.atomic
def start_totp_setup(*, user: User) -> dict:
    if user.two_factor_enabled:
        raise DomainError("La double authentification est déjà active.", code="totp_enabled")
    user.totp_secret = totp.new_secret()
    user.totp_last_step = 0
    user.save(update_fields=["totp_secret", "totp_last_step"])
    uri = totp.provisioning_uri(user.totp_secret, user.email or user.username)
    return {"secret": user.totp_secret, "otpauth_url": uri, "qr_svg": totp.qr_svg(uri)}


@transaction.atomic
def enable_totp(*, user: User, code: str) -> User:
    if user.two_factor_enabled:
        return user
    if not user.totp_secret:
        raise DomainError("Commencez par scanner le QR code.", code="totp_not_started")
    _check_code(user, code)
    user.totp_enabled_at = timezone.now()
    user.save(update_fields=["totp_enabled_at"])
    return user


@transaction.atomic
def disable_totp(*, user: User, code: str) -> User:
    if not user.two_factor_enabled:
        return user
    _check_code(user, code)
    user.totp_secret, user.totp_enabled_at = "", None
    user.save(update_fields=["totp_secret", "totp_enabled_at"])
    return user


def mfa_challenge(*, user: User) -> str:
    """Jeton signé (5 min) remis après le mot de passe, échangé contre les jetons avec le code."""
    return signing.dumps({"uid": str(user.id)}, salt=MFA_SALT)


def complete_mfa(*, mfa_token: str, code: str) -> User:
    try:
        data = signing.loads(mfa_token, salt=MFA_SALT, max_age=MFA_MAX_AGE)
    except signing.BadSignature as exc:
        raise DomainError("Session de connexion expirée, recommencez.", code="mfa_expired") from exc
    user = User.objects.filter(id=data.get("uid"), is_active=True).first()
    if user is None or not user.two_factor_enabled:
        raise DomainError("Session de connexion expirée, recommencez.", code="mfa_expired")
    _check_code(user, code)
    return user


# ── Jetons d'accès personnels ──

MAX_ACTIVE_TOKENS = 10


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def list_access_tokens(*, user: User):
    return PersonalAccessToken.objects.filter(user=user, revoked_at__isnull=True).order_by(
        "-created_at"
    )


@transaction.atomic
def create_access_token(
    *, user: User, name: str, read_only: bool = True, expires_in_days: int | None = None
) -> tuple[PersonalAccessToken, str]:
    """Renvoie (jeton, valeur en clair) : la valeur n'est montrée qu'une seule fois."""
    name = (name or "").strip()[:60]
    if not name:
        raise DomainError("Donnez un nom au jeton (ex. « CI GitHub »).", code="invalid_token")
    if list_access_tokens(user=user).count() >= MAX_ACTIVE_TOKENS:
        raise DomainError(
            f"Au plus {MAX_ACTIVE_TOKENS} jetons actifs : révoquez-en un.", code="too_many_tokens"
        )
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)
    token = PersonalAccessToken.objects.create(
        user=user,
        name=name,
        prefix=raw[:10],
        token_hash=_hash(raw),
        read_only=read_only,
        expires_at=timezone.now() + timedelta(days=expires_in_days) if expires_in_days else None,
    )
    return token, raw


def revoke_access_token(*, user: User, token_id) -> None:
    updated = PersonalAccessToken.objects.filter(
        id=token_id, user=user, revoked_at__isnull=True
    ).update(revoked_at=timezone.now())
    if not updated:
        raise NotFoundError("Jeton introuvable.")


def resolve_access_token(raw: str) -> PersonalAccessToken | None:
    token = (
        PersonalAccessToken.objects.select_related("user")
        .filter(token_hash=_hash(raw), revoked_at__isnull=True, user__is_active=True)
        .first()
    )
    if token is None or (token.expires_at and token.expires_at <= timezone.now()):
        return None
    now = timezone.now()
    # Dernière utilisation notée au plus toutes les 5 minutes (pas d'écriture par requête).
    if token.last_used_at is None or now - token.last_used_at > timedelta(minutes=5):
        PersonalAccessToken.objects.filter(id=token.id).update(last_used_at=now)
    return token
