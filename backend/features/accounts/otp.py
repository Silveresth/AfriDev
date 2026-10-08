"""OTP par SMS : génération, empreinte et vérification."""

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from core.exceptions import DomainError

from .models import PhoneOTP


class InvalidOTPError(DomainError):
    code = "invalid_otp"


def _hash(phone_number: str, code: str) -> str:
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, f"{phone_number}:{code}".encode(), hashlib.sha256).hexdigest()


def generate(phone_number: str) -> str:
    """Invalide les codes précédents et en crée un nouveau (6 chiffres)."""
    PhoneOTP.objects.filter(phone_number=phone_number, consumed_at__isnull=True).update(
        consumed_at=timezone.now()
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    PhoneOTP.objects.create(
        phone_number=phone_number,
        code_hash=_hash(phone_number, code),
        expires_at=timezone.now() + timedelta(seconds=settings.OTP_TTL_SECONDS),
    )
    return code


def verify(phone_number: str, code: str) -> None:
    """Consomme le code s'il est valide, sinon lève InvalidOTPError."""
    otp = (
        PhoneOTP.objects.filter(
            phone_number=phone_number, consumed_at__isnull=True, expires_at__gt=timezone.now()
        )
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        raise InvalidOTPError("Code expiré ou inexistant. Demandez un nouveau code.")
    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise InvalidOTPError("Trop de tentatives. Demandez un nouveau code.")

    if not hmac.compare_digest(otp.code_hash, _hash(phone_number, code.strip())):
        otp.attempts += 1
        otp.save(update_fields=["attempts", "updated_at"])
        raise InvalidOTPError("Code incorrect.")

    otp.consumed_at = timezone.now()
    otp.save(update_fields=["consumed_at", "updated_at"])
