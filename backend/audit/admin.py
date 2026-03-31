from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "resource", "ip_address", "created_at")
    list_filter = ("action", "resource")
    search_fields = ("user__email", "resource_id")
    readonly_fields = (
        "user", "action", "resource", "resource_id",
        "ip_address", "user_agent", "metadata", "created_at",
    )

    def has_delete_permission(self, request, obj=None):
        return False  # Audit logs are immutable

    def has_change_permission(self, request, obj=None):
        return False
