import pytest

from core.exceptions import ConflictError, DomainError, PermissionDeniedError
from features.matchmaking import recommender, selectors, services
from features.notifications import selectors as notification_selectors
from features.profiles import selectors as profile_selectors
from features.profiles import services as profile_services
from features.projects import services as project_services

pytestmark = pytest.mark.django_db(transaction=True)


def test_score_counts_exact_aliases_and_related_skills():
    match = recommender.score(["JS", "django"], ["javascript", "python", "postgresql"])
    assert match.matched == ["javascript", "python"]
    assert match.score == pytest.approx((1 + 0.5) / 3, abs=0.001)
    assert recommender.score([], ["python"]).score == 0


def _set_stack(user, stack, **extra):
    profile = profile_selectors.get_profile_for_user(user_id=user.id)
    profile_services.update_profile(profile=profile, stack=stack, **extra)


def test_recommendations_both_ways(user, other_user):
    _set_stack(other_user, ["react", "django"], open_to_work=True)
    good = project_services.create_project(owner=user, name="Bon", tags=["react", "django"])
    project_services.create_project(owner=user, name="Autre", tags=["rust"])
    project_services.create_project(owner=other_user, name="Le sien", tags=["react"])

    projects = selectors.recommend_projects(user_id=other_user.id)
    assert [(p.name, m.score) for p, m in projects] == [("Bon", 1.0)]

    candidates = selectors.recommend_candidates(project=good)
    assert [p.username for p, _ in candidates] == ["kofi"]


def test_application_flow_notifies_both_sides(user, other_user):
    project = project_services.create_project(owner=user, name="AfriPay", tags=["django"])
    with pytest.raises(DomainError):
        services.apply_to_project(candidate=user, project_id=project.id)

    application = services.apply_to_project(
        candidate=other_user, project_id=project.id, message="Dispo !"
    )
    with pytest.raises(ConflictError):
        services.apply_to_project(candidate=other_user, project_id=project.id)
    with pytest.raises(PermissionDeniedError):
        services.answer_application(application=application, user=other_user, accept=True)

    services.answer_application(application=application, user=user, accept=True)
    assert application.status == "accepted"
    owner_kinds = [n.kind for n in notification_selectors.list_notifications(user=user)]
    candidate_kinds = [n.kind for n in notification_selectors.list_notifications(user=other_user)]
    assert "application_received" in owner_kinds
    assert "application_answered" in candidate_kinds
