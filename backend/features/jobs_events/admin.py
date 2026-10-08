from django.contrib import admin

from .models import JobOffer, TechEvent


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "country", "is_remote", "contract_type", "is_active")
    list_filter = ("contract_type", "is_remote", "is_active")
    search_fields = ("title", "company")


@admin.register(TechEvent)
class TechEventAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "starts_at", "country", "is_online", "organizer")
    list_filter = ("kind", "is_online")
    search_fields = ("title", "organizer")
