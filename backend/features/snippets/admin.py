from django.contrib import admin

from .models import Snippet, SnippetVersion


class SnippetVersionInline(admin.TabularInline):
    model = SnippetVersion
    extra = 0
    readonly_fields = ("number", "content", "created_at")


@admin.register(Snippet)
class SnippetAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "language", "is_public", "published_at", "deleted_at")
    list_filter = ("is_public", "language")
    search_fields = ("title", "owner__username")
    readonly_fields = ("ai_review",)
    inlines = [SnippetVersionInline]
