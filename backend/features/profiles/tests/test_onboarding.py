import pytest

from features.profiles import preferences, services
from features.profiles.models import Profile

pytestmark = pytest.mark.django_db


def test_new_member_needs_onboarding_and_gets_catalogue(auth_client):
    me = auth_client.get("/api/profiles/me/").data
    assert me["needs_onboarding"] is True
    assert sum(me["feed_mix"].values()) == 100

    data = auth_client.get("/api/profiles/me/onboarding/").data
    assert {level["id"] for level in data["levels"]} == set(preferences.EXPERIENCE_LEVELS)
    assert any(
        topic["id"] == "mobile" and "flutter" in topic["suggest"] for topic in data["topics"]
    )
    assert data["current"]["goals"] == []
    assert data["github_stack"] == []


def test_save_preferences_feeds_interests_stack_and_mix(auth_client, user):
    response = auth_client.put(
        "/api/profiles/me/preferences/",
        {
            "experience_level": "junior",
            "goals": ["learn", "job", "learn"],
            "topics": ["mobile", "fintech"],
            "stack": ["Python", "React Native"],
            "learning": ["Flutter"],
        },
        format="json",
    )
    assert response.status_code == 200
    me = response.data
    assert me["needs_onboarding"] is False
    assert me["goals"] == ["learn", "job"]
    assert me["stack"] == ["python", "react-native"]
    for tag in ("mobile", "fintech", "mobile-money", "flutter", "python", "react-native"):
        assert tag in me["interests"]
    # Objectif « job » : les offres pèsent plus que la base commune.
    assert me["feed_mix"]["job"] > preferences.feed_mix(goals=[])["job"]

    current = auth_client.get("/api/profiles/me/onboarding/").data["current"]
    assert current["topics"] == ["mobile", "fintech"]
    assert current["learning"] == ["flutter"]


def test_preferences_are_validated(auth_client):
    bad = auth_client.put("/api/profiles/me/preferences/", {"goals": ["world"]}, format="json")
    assert bad.status_code == 400
    bad = auth_client.put(
        "/api/profiles/me/preferences/", {"experience_level": "wizard"}, format="json"
    )
    assert bad.status_code == 400


def test_skip_marks_onboarding_done(auth_client):
    assert auth_client.post("/api/profiles/me/onboarding/skip/").data["needs_onboarding"] is False


def test_suggestions_rank_people_by_shared_stack(auth_client, user, make_user):
    python_dev = make_user("pydev")
    Profile.objects.filter(user=python_dev).update(stack=["python", "django"], karma_score=5)
    star = make_user("star")
    Profile.objects.filter(user=star).update(stack=["rust"], karma_score=900)

    people = auth_client.get("/api/profiles/me/suggestions/?tags=python").data["people"]
    assert people[0]["username"] == "pydev"
    assert people[0]["shared_stack"] == ["python"]
    assert all(person["username"] != "amina" for person in people)

    services.follow(follower=user, followed=python_dev.profile)
    people = auth_client.get("/api/profiles/me/suggestions/?tags=python").data["people"]
    assert all(person["username"] != "pydev" for person in people)  # déjà suivi


def test_feed_mix_always_sums_to_100():
    for goals in ([], ["learn"], ["help", "hire", "watch"], list(preferences.GOALS)):
        for level in ("", "student", "senior"):
            assert sum(preferences.feed_mix(goals=goals, level=level).values()) == 100


def test_github_languages_become_tags():
    tags = preferences.github_languages_to_tags(
        [{"name": "Dart", "repos": 4}, {"name": "Jupyter Notebook", "repos": 2}, {"name": "Go"}]
    )
    assert tags == ["flutter", "python", "go"]
