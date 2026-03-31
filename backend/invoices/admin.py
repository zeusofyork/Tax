from django.contrib import admin
from .models import Invoice, InvoiceLineItem


class LineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "user", "status", "total", "due_date", "paid_at")
    list_filter = ("status",)
    search_fields = ("invoice_number", "user__email")
    inlines = [LineItemInline]
