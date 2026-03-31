from rest_framework.permissions import BasePermission


class IsClient(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "CLIENT"


class IsTaxPreparer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("TAX_PREPARER", "ADMIN")


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "ADMIN"


class IsOwnerOrPreparer(BasePermission):
    """Object-level: user owns the record or is the assigned preparer."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == "ADMIN":
            return True
        # Direct owner
        if hasattr(obj, "user") and obj.user == user:
            return True
        if hasattr(obj, "user_id") and obj.user_id == user.id:
            return True
        # Assigned preparer
        if hasattr(obj, "preparer") and obj.preparer == user:
            return True
        return False
