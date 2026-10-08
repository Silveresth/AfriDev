from django.contrib import admin

from .models import MediaAsset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "kind", "status", "size_bytes", "created_at")
    list_filter = ("kind", "status")
    readonly_fields = ("variants", "thumbhash", "error")
