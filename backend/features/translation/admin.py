from django.contrib import admin

from .models import Translation


@admin.register(Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = ("id", "target_language", "mode", "status", "created_at")
    list_filter = ("target_language", "mode", "status")
