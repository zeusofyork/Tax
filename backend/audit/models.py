import uuid
from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        LOGIN_FAILED = "LOGIN_FAILED", "Login Failed"
        REGISTER = "REGISTER", "Register"
        VIEW = "VIEW", "View"
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        EXPORT = "EXPORT", "Export"
        UPLOAD = "UPLOAD", "Upload"
        DOWNLOAD = "DOWNLOAD", "Download"
        PAYMENT = "PAYMENT", "Payment"
        PASSWORD_CHANGE = "PASSWORD_CHANGE", "Password Change"
        MFA_ENABLE = "MFA_ENABLE", "MFA Enabled"
        MFA_DISABLE = "MFA_DISABLE", "MFA Disabled"
        ACCOUNT_DELETE = "ACCOUNT_DELETE", "Account Deleted"
        INVOICE_SENT = "INVOICE_SENT", "Invoice Sent"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    resource = models.CharField(max_length=100, blank=True, default="")
    resource_id = models.CharField(max_length=255, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        # Prevent deletion of audit records
        managed = True

    def __str__(self):
        return f"{self.action} by {self.user_id} at {self.created_at}"
