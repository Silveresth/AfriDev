from django.contrib import admin

from .models import ProjectApplication


@admin.register(ProjectApplication)
class ProjectApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "project_id", "candidate", "status", "created_at")
    list_filter = ("status",)
