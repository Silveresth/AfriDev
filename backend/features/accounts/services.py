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
RESERVED_USERNAMES = {
    "me",
    "admin",
    "api",
    "settings",
    "login",
    "logout",
    "new",
    "u",
    "search",
    "everyone",
    "here",
}


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


# ── Pseudo disponible, mot de passe oublié ──


def username_status(username: str) -> dict:
    """Vérification en direct pendant l'inscription : {available, reason, suggestion}."""
    try:
        validate_username(username)
    except ConflictError:
        return {
            "available": False,
            "reason": "Ce nom d'utilisateur est déjà pris.",
            "suggestion": _unique_username(username),
        }
    except DomainError as exc:
        return {"available": False, "reason": exc.message, "suggestion": ""}
    return {"available": True, "reason": "", "suggestion": ""}


def request_password_reset(*, email: str) -> None:
    """Envoie un lien signé (valable PASSWORD_RESET_TIMEOUT). Toujours silencieux : la réponse
    ne révèle jamais si l'adresse correspond à un compte."""
    from django.conf import settings
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    from .tasks import send_password_reset_email

    user = User.objects.filter(email__iexact=(email or "").strip(), is_active=True).first()
    if user is None:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.PUBLIC_WEB_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
    transaction.on_commit(lambda: send_password_reset_email.delay(user.email, link))


@transaction.atomic
def reset_password(*, uid: str, token: str, password: str) -> User:
    """Nouveau mot de passe ; toutes les sessions ouvertes sont révoquées."""
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_str
    from django.utils.http import urlsafe_base64_decode

    from .security import revoke_other_sessions

    try:
        user = User.objects.filter(pk=force_str(urlsafe_base64_decode(uid))).first()
    except (ValueError, DjangoValidationError):
        user = None
    if user is None or not default_token_generator.check_token(user, token):
        raise DomainError("Lien invalide ou expiré. Refaites une demande.", code="invalid_reset")
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise DomainError(
            "Mot de passe trop faible.", code="weak_password", details={"password": exc.messages}
        ) from exc
    user.set_password(password)
    user.save(update_fields=["password"])
    revoke_other_sessions(user=user, current_sid=None)
    return user


# ── Suppression du compte (RGPD, article 17) ──


@transaction.atomic
def delete_account(*, user: User, password: str = "", confirm: str = "") -> None:
    """Supprime définitivement le compte et tout ce qui s'y rattache (profil, publications,
    messages, médias…). Mot de passe exigé s'il existe ; sinon (SMS, GitHub, Google) le membre
    retape son nom d'utilisateur."""
    from features.hubs import services as hub_services
    from features.profiles import services as profile_services

    if user.is_superuser:
        raise PermissionDeniedError(
            "Un compte administrateur ne peut pas être supprimé depuis l'application."
        )
    if user.has_usable_password():
        if not user.check_password(password or ""):
            raise InvalidCredentialsError("Mot de passe incorrect.")
    elif (confirm or "").strip().lower() != user.username.lower():
        raise DomainError(
            "Tapez votre nom d'utilisateur pour confirmer.", code="confirmation_mismatch"
        )
    profile_services.forget_follows(user_id=user.id)
    hub_services.forget_member(user_id=user.id)
    user.delete()


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


@transaction.atomic
def remove_account(*, actor: User, user_id) -> None:
    """Back-office : supprime définitivement un compte et tout ce qui s'y rattache, comme la
    suppression demandée par le membre lui-même. Jamais un administrateur."""
    from features.hubs import services as hub_services
    from features.profiles import services as profile_services

    user = _managed_account(actor=actor, user_id=user_id)
    if user.is_superuser:
        raise PermissionDeniedError("Un compte administrateur ne peut pas être supprimé.")
    profile_services.forget_follows(user_id=user.id)
    hub_services.forget_member(user_id=user.id)
    user.delete()


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
