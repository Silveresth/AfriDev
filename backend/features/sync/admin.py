from django.contrib import admin

from .models import SyncRejection


@admin.register(SyncRejection)
class SyncRejectionAdmin(admin.ModelAdmin):
    list_display = ("user", "table", "op", "code", "created_at", "acknowledged_at")
    list_filter = ("table", "code")
