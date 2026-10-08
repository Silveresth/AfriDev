from django.contrib import admin

from .models import Comment, ThreadSummary


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post_id", "author", "created_at", "deleted_at")
    search_fields = ("body", "author__username")


admin.site.register(ThreadSummary)
