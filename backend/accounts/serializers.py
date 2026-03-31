import secrets
import hashlib
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import pyotp
import requests
from django.conf import settings

from accounts.models import LoginHistory, EmailVerificationToken, PasswordResetToken
from audit.utils import log_action

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role and MFA status to JWT claims."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        token["mfa_verified"] = False  # Set true after MFA step
        return token


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=12)
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, default="")
    recaptcha_token = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_recaptcha_token(self, value):
        secret = settings.RECAPTCHA_SECRET_KEY
        if not secret:
            return value  # Skip in dev
        resp = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": secret, "response": value},
            timeout=5,
        )
        result = resp.json()
        if not result.get("success") or result.get("score", 0) < 0.5:
            raise serializers.ValidationError("CAPTCHA verification failed.")
        return value

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        validated_data.pop("recaptcha_token")
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)

        # Create email verification token
        token = secrets.token_urlsafe(48)
        EmailVerificationToken.objects.create(
            user=user,
            token=token,
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )
        return user


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    device_fingerprint = serializers.CharField(required=False, default="")


class MFASetupSerializer(serializers.Serializer):
    """Returns TOTP secret and QR URI for enrollment."""
    pass


class MFAVerifySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, min_length=6)


class MFABackupCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=12)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=12)
    new_password_confirm = serializers.CharField()

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=12)
    new_password_confirm = serializers.CharField()

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "role",
                  "mfa_enabled", "email_verified", "date_joined"]
        read_only_fields = ["id", "email", "role", "email_verified", "date_joined"]


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = ["id", "ip_address", "user_agent", "success", "failure_reason", "created_at"]
