from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import SocialAccount, User


@admin.register(User)
class AfriDevUserAdmin(UserAdmin):
    list_display = ("username", "email", "phone_number", "is_staff", "date_joined")
    search_fields = ("username", "email", "phone_number")
    fieldsets = UserAdmin.fieldsets + (
        ("Téléphone", {"fields": ("phone_number", "phone_verified_at")}),
    )


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "username", "created_at")
    list_filter = ("provider",)
    search_fields = ("username", "user__username")
