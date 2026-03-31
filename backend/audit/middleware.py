from .utils import get_client_ip


class AuditMiddleware:
    """Attaches IP and user agent to request for audit logging."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.client_ip = get_client_ip(request)
        request.client_user_agent = request.META.get("HTTP_USER_AGENT", "")
        return self.get_response(request)
