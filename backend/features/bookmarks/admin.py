from django.contrib import admin

from .models import BookmarkCollection, BookmarkItem


@admin.register(BookmarkCollection)
class BookmarkCollectionAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_private", "created_at")
    search_fields = ("name", "owner__username")


@admin.register(BookmarkItem)
class BookmarkItemAdmin(admin.ModelAdmin):
    list_display = ("collection", "owner", "post_id", "question_id", "snippet_id", "created_at")
