"""Écritures du back-office : délèguent aux services des features propriétaires."""

from features.accounts import services as account_services


def set_member_active(*, actor, user_id, active: bool):
    return account_services.set_account_active(actor=actor, user_id=user_id, active=active)


def set_member_staff(*, actor, user_id, staff: bool):
    return account_services.set_account_staff(actor=actor, user_id=user_id, staff=staff)
