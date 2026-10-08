from django.contrib import admin

from .models import OnboardingGuide


@admin.register(OnboardingGuide)
class OnboardingGuideAdmin(admin.ModelAdmin):
    list_display = ("repo_url", "requested_by", "status", "commit_sha", "created_at")
    list_filter = ("status",)
    search_fields = ("repo_url",)
