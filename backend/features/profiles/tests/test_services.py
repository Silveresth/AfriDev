import pytest

from core.exceptions import PermissionDeniedError
from features.profiles import selectors, services
from features.profiles.models import Profile

pytestmark = pytest.mark.django_db(transaction=True)


def test_update_profile_normalizes_stack(user):
    profile = selectors.get_profile_for_user(user_id=user.id)
    services.update_profile(profile=profile, stack=["React", "#Django", "react", " "], bio="Hello")
    profile.refresh_from_db()
    assert profile.stack == ["react", "django"]
    assert profile.bio == "Hello"


def test_offline_update_only_on_own_profile(user, other_user):
    with pytest.raises(PermissionDeniedError):
        services.apply_offline_update(user=user, profile_id=other_user.id, data={"bio": "hack"})
    services.apply_offline_update(user=user, profile_id=user.id, data={"bio": "Hors ligne"})
    assert selectors.get_profile_for_user(user_id=user.id).bio == "Hors ligne"


def test_ai_bio_is_stored_as_suggestion(user, fake_llm):
    fake_llm.when("bio publique", "Développeuse Django passionnée par le mobile money.")
    profile = selectors.get_profile_for_user(user_id=user.id)
    services.update_profile(profile=profile, stack=["django"])

    services.request_ai_bio(profile=profile)

    profile.refresh_from_db()
    assert profile.ai_bio_status == Profile.AiStatus.READY
    assert profile.ai_bio_suggestion.startswith("Développeuse Django")
    assert profile.bio == ""  # la bio n'est remplacée qu'avec l'accord de l'utilisateur
