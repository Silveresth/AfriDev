from django.contrib import admin

from .models import PollVote, Post, PostLike


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "author",
        "kind",
        "like_count",
        "comment_count",
        "created_at",
        "deleted_at",
    )
    list_filter = ("kind",)
    search_fields = ("body", "author__username")


admin.site.register(PollVote)
admin.site.register(PostLike)
