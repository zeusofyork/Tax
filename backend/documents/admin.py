from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("user", "doc_type", "tax_year", "scan_status", "uploaded_at")
    list_filter = ("doc_type", "scan_status", "tax_year")
    search_fields = ("user__email", "original_filename")
    readonly_fields = ("file", "original_filename", "file_size", "mime_type", "scan_status")
