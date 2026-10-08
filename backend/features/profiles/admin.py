from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("username", "display_name", "open_to_work", "ai_bio_status", "updated_at")
    list_filter = ("open_to_work", "ai_bio_status")
    search_fields = ("username", "display_name", "github_username")
