from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True, default="")

    class Meta:
        model = AuditLog
        fields = [
            "id", "user_email", "action", "resource", "resource_id",
            "ip_address", "metadata", "created_at",
        ]
