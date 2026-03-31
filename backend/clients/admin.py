from django.contrib import admin
from .models import TaxProfile, Dependent


@admin.register(TaxProfile)
class TaxProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "filing_status", "state", "updated_at")
    search_fields = ("user__email",)


@admin.register(Dependent)
class DependentAdmin(admin.ModelAdmin):
    list_display = ("tax_profile", "relationship", "created_at")
