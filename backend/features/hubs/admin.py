from django.contrib import admin

from .models import Hub, HubMembership


@admin.register(Hub)
class HubAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "target_country", "is_verified", "member_count", "deleted_at")
    list_filter = ("is_verified",)
    search_fields = ("slug", "name")


@admin.register(HubMembership)
class HubMembershipAdmin(admin.ModelAdmin):
    list_display = ("hub", "user", "role", "created_at")
    list_filter = ("role",)
