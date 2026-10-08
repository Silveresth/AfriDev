"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from django.db.models import QuerySet

from .models import OnboardingGuide


def get_guide(*, guide_id) -> OnboardingGuide | None:
    return OnboardingGuide.objects.alive().filter(id=guide_id).first()


def list_guides(*, user=None, project_id=None) -> QuerySet[OnboardingGuide]:
    guides = OnboardingGuide.objects.alive()
    if user is not None:
        guides = guides.filter(requested_by=user)
    if project_id:
        guides = guides.filter(project_id=project_id, status=OnboardingGuide.Status.READY)
    return guides


def guide_stats(*, since) -> dict:
    guides = OnboardingGuide.objects.alive().filter(created_at__gte=since)
    return {"new": guides.count(), "failed": guides.filter(status="failed").count()}
