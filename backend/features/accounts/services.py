"""Écritures (création, mise à jour, publication). Seul point d'entrée en écriture."""

import re

from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from core.exceptions import ConflictError, DomainError, NotFoundError, PermissionDeniedError
from integrations import sms

from . import oauth, otp
from .events import user_registered
from .models import SocialAccount, User

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,30}$")
# Segments d'URL déjà pris par le front (/u/<username>, /api/profiles/me/…).
RESERVED_USERNAMES = {"me", "admin", "api", "settings", "login", "logout", "new", "u"}


class InvalidCredentialsError(DomainError):
    code = "invalid_credentials"
    status_code = 401


def validate_username(username: str) -> str:
    if not USERNAME_PATTERN.match(username or ""):
        raise DomainError(
            "Le nom d'utilisateur doit faire 3 à 30 caractères (lettres, chiffres, _).",
            code="invalid_username",
        )
    if username.lower() in RESERVED_USERNAMES:
        raise DomainError("Ce nom d'utilisateur est réservé.", code="invalid_username")
    if User.objects.filter(username__iexact=username).exists():
        raise ConflictError("Ce nom d'utilisateur est déjà pris.", code="username_taken")
    return username


def _unique_username(base: str) -> str:
    """Dérive un nom libre à partir d'un pseudo GitHub, d'un e-mail ou d'un numéro."""
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", base)[:24].strip("_") or "dev"
    if len(cleaned) < 3:
        cleaned = f"{cleaned}_dev"
    candidate, suffix = cleaned, 1
    while (
        candidate.lower() in RESERVED_USERNAMES
        or User.objects.filter(username__iexact=candidate).exists()
    ):
        suffix += 1
        candidate = f"{cleaned}{suffix}"
    return candidate


class AccountSuspendedError(DomainError):
    code = "account_suspended"
    status_code = 403


def ensure_active(user: User) -> None:
    if not user.is_active:
        raise AccountSuspendedError("Ce compte est suspendu. Contactez la modération.")


def issue_tokens(user: User, *, request=None) -> dict:
    """Jetons de session, pour toutes les méthodes de connexion (mot de passe, SMS, OAuth).
    Chaque connexion ouvre une session (appareil) révocable depuis les réglages."""
    from .security import start_session

    ensure_active(user)
    update_last_login(None, user)
    return start_session(user=user, request=request)


def _announce(user: User, *, display_name: str = "", avatar_url: str = "", github: str = ""):
    user_registered.send(
        sender=User,
        user_id=user.id,
        username=user.username,
        display_name=display_name or user.get_full_name() or user.username,
        avatar_url=avatar_url,
        github_username=github,
    )


@transaction.atomic
def register_user(*, username: str, email: str, password: str, display_name: str = "") -> User:
    validate_username(username)
    email = User.objects.normalize_email(email).lower()
    if User.objects.filter(email__iexact=email).exists():
        raise ConflictError("Un compte existe déjà avec cet e-mail.", code="email_taken")
    try:
        validate_password(password)
    except DjangoValidationError as exc:
        raise DomainError(
            "Mot de passe trop faible.", code="weak_password", details={"password": exc.messages}
        ) from exc

    user = User.objects.create_user(
        username=username, email=email, password=password, first_name=display_name[:150]
    )
    _announce(user, display_name=display_name)
    return user


def authenticate_user(*, identifier: str, password: str) -> User:
    """Connexion par nom d'utilisateur ou e-mail."""
    match = User.objects.filter(email__iexact=identifier).first() if "@" in identifier else None
    username = match.username if match else identifier
    user = authenticate(username=username, password=password)
    if user is None:
        # authenticate() refuse aussi les comptes suspendus : on le dit clairement.
        suspended = User.objects.filter(username=username, is_active=False).first()
        if suspended and suspended.check_password(password):
            raise AccountSuspendedError("Ce compte est suspendu. Contactez la modération.")
        raise InvalidCredentialsError("Identifiants incorrects.")
    return user


def request_phone_otp(*, phone_number: str) -> str:
    """Génère un code et programme l'envoi du SMS. Renvoie le numéro normalisé."""
    try:
        phone_number = sms.normalize_phone(phone_number)
    except ValueError as exc:
        raise DomainError(str(exc), code="invalid_phone") from exc

    from .tasks import send_otp_sms

    with transaction.atomic():
        code = otp.generate(phone_number)
        transaction.on_commit(lambda: send_otp_sms.delay(phone_number, code))
    return phone_number


@transaction.atomic
def login_with_phone(*, phone_number: str, code: str) -> tuple[User, bool]:
    """Vérifie le code ; crée le compte au premier passage. Renvoie (user, créé)."""
    try:
        phone_number = sms.normalize_phone(phone_number)
    except ValueError as exc:
        raise DomainError(str(exc), code="invalid_phone") from exc
    otp.verify(phone_number, code)

    user = User.objects.filter(phone_number=phone_number).first()
    created = user is None
    if created:
        user = User(
            username=_unique_username(f"dev_{phone_number[-4:]}"), phone_number=phone_number
        )
        user.set_unusable_password()
    user.phone_verified_at = timezone.now()
    user.save()
    if created:
        _announce(user)
    return user, created


@transaction.atomic
def login_with_oauth(*, provider: str, code: str, redirect_uri: str | None = None):
    """Connexion GitHub / GitLab. Renvoie (user, créé)."""
    identity = oauth.fetch_identity(provider, code, redirect_uri)

    account = (
        SocialAccount.objects.select_related("user")
        .filter(provider=provider, uid=identity.uid)
        .first()
    )
    if account:
        if account.username != identity.username:
            account.username = identity.username
            account.save(update_fields=["username", "updated_at"])
        return account.user, False

    # L'e-mail est vérifié par le fournisseur : on rattache au compte existant.
    user = User.objects.filter(email__iexact=identity.email).first() if identity.email else None
    created = user is None
    if created:
        user = User(
            username=_unique_username(identity.username),
            email=(identity.email or "").lower(),
            first_name=identity.name[:150],
        )
        user.set_unusable_password()
        user.save()

    SocialAccount.objects.create(
        user=user, provider=provider, uid=identity.uid, username=identity.username
    )
    if created:
        _announce(
            user,
            display_name=identity.name,
            avatar_url=identity.avatar_url,
            github=identity.username if provider == "github" else "",
        )
    return user, created


# ── Back-office : gestion des membres ──


def _managed_account(*, actor: User, user_id) -> User:
    """Compte modifiable par `actor` : jamais soi-même ; staff et admins réservés aux admins."""
    user = User.objects.filter(id=user_id).first()
    if user is None:
        raise NotFoundError("Membre introuvable.")
    if user.id == actor.id:
        raise PermissionDeniedError("Vous ne pouvez pas modifier votre propre compte ici.")
    if (user.is_staff or user.is_superuser) and not actor.is_superuser:
        raise PermissionDeniedError("Seul un administrateur peut modifier un compte de l'équipe.")
    return user


def set_account_active(*, actor: User, user_id, active: bool) -> User:
    """Suspend ou réactive un compte. Un compte suspendu ne peut plus se connecter ni
    utiliser ses jetons en cours (l'API refuse les comptes inactifs)."""
    user = _managed_account(actor=actor, user_id=user_id)
    if user.is_active != active:
        user.is_active = active
        user.save(update_fields=["is_active"])
    return user


def set_account_staff(*, actor: User, user_id, staff: bool) -> User:
    """Donne ou retire l'accès au back-office (modération). Réservé aux administrateurs."""
    if not actor.is_superuser:
        raise PermissionDeniedError("Seul un administrateur peut gérer l'équipe de modération.")
    user = _managed_account(actor=actor, user_id=user_id)
    if user.is_superuser:
        raise DomainError("Un administrateur garde toujours l'accès.", code="superuser")
    if user.is_staff != staff:
        user.is_staff = staff
        user.save(update_fields=["is_staff"])
    return user
