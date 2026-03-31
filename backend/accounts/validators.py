import re
from django.core.exceptions import ValidationError


class SymbolValidator:
    def validate(self, password, user=None):
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]', password):
            raise ValidationError("Password must contain at least one special character.")

    def get_help_text(self):
        return "Your password must contain at least one special character."


class UppercaseValidator:
    def validate(self, password, user=None):
        if not re.search(r"[A-Z]", password):
            raise ValidationError("Password must contain at least one uppercase letter.")

    def get_help_text(self):
        return "Your password must contain at least one uppercase letter."


class NumberValidator:
    def validate(self, password, user=None):
        if not re.search(r"\d", password):
            raise ValidationError("Password must contain at least one number.")

    def get_help_text(self):
        return "Your password must contain at least one number."
