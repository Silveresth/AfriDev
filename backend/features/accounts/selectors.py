"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import Q, QuerySet

from core.stats import count_per_day

from .models import SocialAccount, User


def get_user(user_id) -> User | None:
    return User.objects.filter(id=user_id, is_active=True).first()


def get_users(user_ids) -> dict:
    """{id: user} pour un lot d'identifiants (évite les requêtes en boucle)."""
    return {user.id: user for user in User.objects.filter(id__in=list(user_ids))}


def get_github_username(user_id) -> str:
    account = SocialAccount.objects.filter(user_id=user_id, provider="github").first()
    return account.username if account else ""


def list_staff_ids() -> list:
    return list(User.objects.filter(is_staff=True, is_active=True).values_list("id", flat=True))


# ── Back-office ──


def get_account(*, user_id) -> User | None:
    """Compte, même suspendu (gestion des membres)."""
    return User.objects.filter(id=user_id).first()


def search_accounts(*, query: str = "", role: str | None = None) -> QuerySet[User]:
    """Membres pour le back-office. role : staff, suspended ou None (tous)."""
    users = User.objects.order_by("-date_joined")
    if query:
        users = users.filter(
            Q(username__icontains=query)
            | Q(email__icontains=query)
            | Q(phone_number__icontains=query)
        )
    if role == "staff":
        users = users.filter(is_staff=True)
    elif role == "suspended":
        users = users.filter(is_active=False)
    return users


def user_stats(*, since) -> dict:
    users = User.objects.all()
    return {
        "total": users.count(),
        "new": users.filter(date_joined__gte=since).count(),
        "active": users.filter(last_login__gte=since).count(),
        "staff": users.filter(is_staff=True).count(),
        "suspended": users.filter(is_active=False).count(),
    }


def signups_per_day(*, since) -> dict[str, int]:
    return count_per_day(User.objects.all(), since=since, field="date_joined")
