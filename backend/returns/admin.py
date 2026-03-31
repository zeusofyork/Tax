from django.contrib import admin
from .models import TaxReturn, ReturnStatusHistory, W2Entry, Income1099


@admin.register(TaxReturn)
class TaxReturnAdmin(admin.ModelAdmin):
    list_display = ("user", "tax_year", "status", "filing_status", "submitted_at", "created_at")
    list_filter = ("status", "tax_year", "filing_status")
    search_fields = ("user__email",)


@admin.register(ReturnStatusHistory)
class ReturnStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("tax_return", "old_status", "new_status", "changed_by", "created_at")
    readonly_fields = ("tax_return", "old_status", "new_status", "changed_by", "note", "created_at")


@admin.register(W2Entry)
class W2EntryAdmin(admin.ModelAdmin):
    list_display = ("tax_return", "employer_name", "wages", "federal_withheld")


@admin.register(Income1099)
class Income1099Admin(admin.ModelAdmin):
    list_display = ("tax_return", "form_type", "payer_name", "amount")
