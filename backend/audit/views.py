from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ["action", "resource"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return AuditLog.objects.all()
