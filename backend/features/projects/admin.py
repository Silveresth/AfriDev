from django.contrib import admin

from .models import Issue, Project


class IssueInline(admin.TabularInline):
    model = Issue
    extra = 0
    fields = ("number", "title", "url", "is_open")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_recruiting", "stars", "last_synced_at", "deleted_at")
    list_filter = ("is_recruiting",)
    search_fields = ("name", "owner__username")
    inlines = [IssueInline]
