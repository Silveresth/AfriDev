from django.contrib import admin

from .models import Snippet, SnippetComment, SnippetVersion


class SnippetVersionInline(admin.TabularInline):
    model = SnippetVersion
    extra = 0
    readonly_fields = ("number", "content", "created_at")


@admin.register(Snippet)
class SnippetAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "owner",
        "language",
        "is_public",
        "comment_count",
        "published_at",
        "deleted_at",
    )
    list_filter = ("is_public", "language")
    search_fields = ("title", "owner__username")
    readonly_fields = ("ai_review", "comment_count")
    inlines = [SnippetVersionInline]


@admin.register(SnippetComment)
class SnippetCommentAdmin(admin.ModelAdmin):
    list_display = ("snippet", "author", "created_at", "deleted_at")
    list_filter = ("created_at",)
    search_fields = ("body", "author__username")
    raw_id_fields = ("snippet", "author", "parent")

