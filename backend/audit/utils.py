from .models import AuditLog


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def log_action(user, action, resource="", resource_id="", request=None, metadata=None):
    AuditLog.objects.create(
        user=user,
        action=action,
        resource=resource,
        resource_id=str(resource_id),
        ip_address=getattr(request, "client_ip", None) if request else None,
        user_agent=getattr(request, "client_user_agent", "") if request else "",
        metadata=metadata or {},
    )
