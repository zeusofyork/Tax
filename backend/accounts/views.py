import secrets
import hashlib
import pyotp
import qrcode
import io
import base64

from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

import stripe

from accounts.models import LoginHistory, EmailVerificationToken, PasswordResetToken
from accounts.serializers import (
    RegisterSerializer, VerifyEmailSerializer, LoginSerializer,
    MFAVerifySerializer, PasswordChangeSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    UserProfileSerializer, LoginHistorySerializer,
)
from audit.utils import log_action

User = get_user_model()
stripe.api_key = settings.STRIPE_SECRET_KEY


class LoginRateThrottle(AnonRateThrottle):
    rate = "5/min"


# ==================== REGISTRATION ====================

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    # Create Stripe customer
    try:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        user.save(update_fields=["stripe_customer_id"])
    except stripe.error.StripeError:
        pass  # Non-blocking; retry via Celery if needed

    # Send verification email
    token_obj = user.verification_tokens.first()
    if token_obj:
        frontend_url = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else ""
        verify_url = f"{frontend_url}/verify-email?token={token_obj.token}"
        send_mail(
            subject="Verify your EasyTax account",
            message=f"Click this link to verify your email: {verify_url}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

    log_action(user, "REGISTER", "User", user.id, request)
    return Response({"message": "Account created. Please check your email to verify."}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email(request):
    serializer = VerifyEmailSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        token_obj = EmailVerificationToken.objects.get(
            token=serializer.validated_data["token"],
            used=False,
            expires_at__gt=timezone.now(),
        )
    except EmailVerificationToken.DoesNotExist:
        return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

    token_obj.user.email_verified = True
    token_obj.user.save(update_fields=["email_verified"])
    token_obj.used = True
    token_obj.save(update_fields=["used"])
    return Response({"message": "Email verified successfully."})


# ==================== LOGIN ====================

@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # Rate limit check per account
    email = data["email"].lower()
    lockout_key = f"login_lockout:{email}"
    if cache.get(lockout_key):
        return Response({"error": "Account temporarily locked. Try again in 15 minutes."},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)

    fail_key = f"login_fails:{email}"
    user = authenticate(request, username=email, password=data["password"])

    if user is None:
        # Track failures
        fails = cache.get(fail_key, 0) + 1
        cache.set(fail_key, fails, timeout=900)
        if fails >= 5:
            cache.set(lockout_key, True, timeout=900)
            # Alert user
            try:
                target_user = User.objects.get(email=email)
                send_mail(
                    subject="EasyTax: Account Locked",
                    message="Your account has been temporarily locked due to multiple failed login attempts.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=True,
                )
            except User.DoesNotExist:
                pass

        LoginHistory.objects.create(
            user=User.objects.filter(email=email).first(),
            ip_address=getattr(request, "client_ip", "0.0.0.0"),
            user_agent=getattr(request, "client_user_agent", ""),
            device_fingerprint=data.get("device_fingerprint", ""),
            success=False,
            failure_reason="Invalid credentials",
        )
        return Response({"error": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({"error": "Account is deactivated."}, status=status.HTTP_403_FORBIDDEN)
    if not user.email_verified:
        return Response({"error": "Please verify your email first."}, status=status.HTTP_403_FORBIDDEN)

    # Clear fail counter
    cache.delete(fail_key)
    cache.delete(lockout_key)

    # Check if MFA is enabled
    if user.mfa_enabled:
        # Return a temporary token to complete MFA
        mfa_token = secrets.token_urlsafe(32)
        cache.set(f"mfa_pending:{mfa_token}", str(user.id), timeout=300)
        return Response({"mfa_required": True, "mfa_token": mfa_token})

    # No MFA — issue tokens
    return _issue_tokens(user, request, data.get("device_fingerprint", ""))


@api_view(["POST"])
@permission_classes([AllowAny])
def mfa_verify(request):
    mfa_token = request.data.get("mfa_token", "")
    user_id = cache.get(f"mfa_pending:{mfa_token}")
    if not user_id:
        return Response({"error": "Invalid or expired MFA session."}, status=status.HTTP_400_BAD_REQUEST)

    serializer = MFAVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    code = serializer.validated_data["code"]

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_400_BAD_REQUEST)

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(code, valid_window=1):
        # Check backup codes
        hashed = hashlib.sha256(code.encode()).hexdigest()
        if hashed in user.mfa_backup_codes:
            user.mfa_backup_codes.remove(hashed)
            user.save(update_fields=["mfa_backup_codes"])
        else:
            return Response({"error": "Invalid MFA code."}, status=status.HTTP_401_UNAUTHORIZED)

    cache.delete(f"mfa_pending:{mfa_token}")
    return _issue_tokens(user, request, request.data.get("device_fingerprint", ""))


def _issue_tokens(user, request, device_fingerprint=""):
    refresh = RefreshToken.for_user(user)
    refresh["mfa_verified"] = True
    refresh["role"] = user.role

    LoginHistory.objects.create(
        user=user,
        ip_address=getattr(request, "client_ip", "0.0.0.0"),
        user_agent=getattr(request, "client_user_agent", ""),
        device_fingerprint=device_fingerprint,
        success=True,
    )

    # Flag new device and send alert
    if device_fingerprint and device_fingerprint not in user.trusted_devices:
        send_mail(
            subject="EasyTax: New Device Login",
            message=f"A new device logged into your account from IP {getattr(request, 'client_ip', 'unknown')}.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

    log_action(user, "LOGIN", "User", user.id, request)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserProfileSerializer(user).data,
    })


# ==================== MFA SETUP ====================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_setup(request):
    user = request.user
    secret = pyotp.random_base32()
    user.mfa_secret = secret
    user.save(update_fields=["mfa_secret"])

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="EasyTax")

    # Generate QR code as base64
    qr = qrcode.make(uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    # Generate backup codes
    backup_codes = [secrets.token_hex(6) for _ in range(8)]
    user.mfa_backup_codes = [hashlib.sha256(c.encode()).hexdigest() for c in backup_codes]
    user.save(update_fields=["mfa_backup_codes"])

    return Response({
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_b64}",
        "backup_codes": backup_codes,
        "message": "Scan the QR code with your authenticator app, then verify with a code.",
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_confirm(request):
    """Confirm MFA enrollment with a valid code."""
    serializer = MFAVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(serializer.validated_data["code"], valid_window=1):
        return Response({"error": "Invalid code. Try again."}, status=status.HTTP_400_BAD_REQUEST)

    user.mfa_enabled = True
    user.save(update_fields=["mfa_enabled"])
    log_action(user, "MFA_ENABLE", "User", user.id, request)
    return Response({"message": "MFA enabled successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_disable(request):
    serializer = MFAVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(serializer.validated_data["code"], valid_window=1):
        return Response({"error": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

    user.mfa_enabled = False
    user.mfa_secret = ""
    user.mfa_backup_codes = []
    user.save(update_fields=["mfa_enabled", "mfa_secret", "mfa_backup_codes"])
    log_action(user, "MFA_DISABLE", "User", user.id, request)
    return Response({"message": "MFA disabled."})


# ==================== PASSWORD ====================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user
    if not user.check_password(serializer.validated_data["current_password"]):
        return Response({"error": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(serializer.validated_data["new_password"])
    user.save()
    log_action(user, "PASSWORD_CHANGE", "User", user.id, request)
    return Response({"message": "Password changed. Please log in again."})


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()

    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        # Don't reveal whether email exists
        return Response({"message": "If an account exists, a reset link has been sent."})

    token = secrets.token_urlsafe(48)
    PasswordResetToken.objects.create(
        user=user,
        token=token,
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    frontend_url = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else ""
    reset_url = f"{frontend_url}/reset-password?token={token}"
    send_mail(
        subject="EasyTax: Password Reset",
        message=f"Click this link to reset your password: {reset_url}\n\nThis link expires in 1 hour.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )
    return Response({"message": "If an account exists, a reset link has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        token_obj = PasswordResetToken.objects.get(
            token=data["token"], used=False, expires_at__gt=timezone.now()
        )
    except PasswordResetToken.DoesNotExist:
        return Response({"error": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

    user = token_obj.user
    user.set_password(data["new_password"])
    user.save()
    token_obj.used = True
    token_obj.save(update_fields=["used"])
    log_action(user, "PASSWORD_CHANGE", "User", user.id, request)
    return Response({"message": "Password reset successfully."})


# ==================== PROFILE ====================

@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    user = request.user
    if request.method == "GET":
        return Response(UserProfileSerializer(user).data)
    serializer = UserProfileSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    log_action(user, "UPDATE", "User", user.id, request)
    return Response(serializer.data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    user = request.user
    user.soft_delete()
    log_action(user, "ACCOUNT_DELETE", "User", user.id, request)
    return Response({"message": "Account scheduled for deletion in 30 days."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def login_history(request):
    entries = request.user.login_history.all()[:50]
    serializer = LoginHistorySerializer(entries, many=True)
    return Response(serializer.data)


# ==================== TRUST DEVICE ====================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trust_device(request):
    fingerprint = request.data.get("device_fingerprint", "")
    if not fingerprint:
        return Response({"error": "Device fingerprint required."}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    if fingerprint not in user.trusted_devices:
        user.trusted_devices.append(fingerprint)
        user.save(update_fields=["trusted_devices"])
    return Response({"message": "Device trusted for 30 days."})


# ==================== TOKEN REFRESH / LOGOUT ====================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        token = RefreshToken(request.data.get("refresh", ""))
        token.blacklist()
    except Exception:
        pass
    log_action(request.user, "LOGOUT", "User", request.user.id, request)
    return Response({"message": "Logged out."})
