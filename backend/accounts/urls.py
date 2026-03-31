from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Registration & verification
    path("register/", views.register, name="register"),
    path("verify-email/", views.verify_email, name="verify-email"),

    # Login / Logout
    path("login/", views.login, name="login"),
    path("logout/", views.logout, name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),

    # MFA
    path("mfa/setup/", views.mfa_setup, name="mfa-setup"),
    path("mfa/confirm/", views.mfa_confirm, name="mfa-confirm"),
    path("mfa/verify/", views.mfa_verify, name="mfa-verify"),
    path("mfa/disable/", views.mfa_disable, name="mfa-disable"),

    # Password
    path("password/change/", views.change_password, name="change-password"),
    path("password/reset/", views.password_reset_request, name="password-reset-request"),
    path("password/reset/confirm/", views.password_reset_confirm, name="password-reset-confirm"),

    # Profile
    path("profile/", views.profile, name="profile"),
    path("profile/delete/", views.delete_account, name="delete-account"),
    path("profile/login-history/", views.login_history, name="login-history"),
    path("device/trust/", views.trust_device, name="trust-device"),
]
