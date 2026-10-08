"""Export des données personnelles (RGPD, article 20) : un fichier JSON lisible et réutilisable.

Chaque feature fournit ses propres données via `selectors.export_for_user` ; aucun secret
(empreinte de mot de passe, secret TOTP, empreintes de jetons) n'est exporté.
"""

from django.utils import timezone

from features.bookmarks import selectors as bookmark_selectors
from features.discussions import selectors as discussion_selectors
from features.feed import selectors as feed_selectors
from features.hubs import selectors as hub_selectors
from features.jobs_events import selectors as jobs_selectors
from features.profiles import selectors as profile_selectors
from features.projects import selectors as project_selectors
from features.qa import selectors as qa_selectors
from features.snippets import selectors as snippet_selectors

from .models import PersonalAccessToken, SocialAccount, User, UserSession

SECTIONS = (
    profile_selectors,
    feed_selectors,
    discussion_selectors,
    qa_selectors,
    snippet_selectors,
    project_selectors,
    hub_selectors,
    bookmark_selectors,
    jobs_selectors,
)


def export_user_data(*, user: User) -> dict:
    data = {
        "format": "afridev-export/1",
        "generated_at": timezone.now(),
        "account": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone_number": user.phone_number,
            "date_joined": user.date_joined,
            "last_login": user.last_login,
            "two_factor_enabled": user.two_factor_enabled,
        },
        "linked_accounts": list(
            SocialAccount.objects.filter(user=user).values("provider", "username", "created_at")
        ),
        "sessions": list(
            UserSession.objects.filter(user=user).values(
                "user_agent", "ip_address", "created_at", "last_used_at", "revoked_at"
            )
        ),
        "access_tokens": list(
            PersonalAccessToken.objects.filter(user=user).values(
                "name", "prefix", "read_only", "created_at", "last_used_at", "revoked_at"
            )
        ),
    }
    for section in SECTIONS:
        data.update(section.export_for_user(user_id=user.id))
    return data
