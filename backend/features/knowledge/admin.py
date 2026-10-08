from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "source_type", "source_id", "updated_at", "deleted_at")
    list_filter = ("source_type",)
    search_fields = ("title",)
    exclude = ("content_hash",)
