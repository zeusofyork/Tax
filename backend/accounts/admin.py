from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, LoginHistory


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "mfa_enabled", "is_active")
    list_filter = ("role", "mfa_enabled", "is_active", "email_verified")
    search_fields = ("email",)
    ordering = ("-date_joined",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("first_name", "last_name", "phone")}),
        ("Permissions", {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("MFA", {"fields": ("mfa_enabled",)}),
        ("Stripe", {"fields": ("stripe_customer_id",)}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "first_name", "last_name", "password1", "password2")}),
    )


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ("user", "ip_address", "success", "created_at")
    list_filter = ("success",)
    readonly_fields = ("user", "ip_address", "user_agent", "device_fingerprint", "success", "failure_reason", "created_at")
