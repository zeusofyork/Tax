import uuid
from django.db import models
from django.conf import settings
from encrypted_model_fields.fields import EncryptedTextField


class TaxReturn(models.Model):
    class Status(models.TextChoices):
        INTAKE = "INTAKE", "Intake"
        DOCUMENTS_REQUESTED = "DOCUMENTS_REQUESTED", "Documents Requested"
        DOCUMENTS_RECEIVED = "DOCUMENTS_RECEIVED", "Documents Received"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        CLIENT_REVIEW = "CLIENT_REVIEW", "Client Review"
        APPROVED = "APPROVED", "Approved"
        FILED = "FILED", "Filed"
        COMPLETE = "COMPLETE", "Complete"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tax_returns"
    )
    preparer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prepared_returns",
    )
    tax_year = models.PositiveIntegerField()
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.INTAKE)
    filing_status = models.CharField(max_length=10, blank=True, default="")

    # Encrypted JSON blobs for all sensitive form data
    form_data = EncryptedTextField(blank=True, default="{}")
    computed_result = EncryptedTextField(blank=True, default="{}")

    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_returns"
        ordering = ["-tax_year", "-created_at"]
        unique_together = [("user", "tax_year")]

    def __str__(self):
        return f"{self.user.email} - {self.tax_year} ({self.status})"


class ReturnStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tax_return = models.ForeignKey(
        TaxReturn, on_delete=models.CASCADE, related_name="status_history"
    )
    old_status = models.CharField(max_length=25, blank=True, default="")
    new_status = models.CharField(max_length=25)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "return_status_history"
        ordering = ["-created_at"]


class W2Entry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tax_return = models.ForeignKey(TaxReturn, on_delete=models.CASCADE, related_name="w2s")
    employer_name = models.CharField(max_length=255, blank=True, default="")
    employer_ein = models.CharField(max_length=20, blank=True, default="")
    wages = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    federal_withheld = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    state_withheld = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ss_wages = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ss_withheld = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medicare_wages = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medicare_withheld = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "w2_entries"


class Income1099(models.Model):
    class Type1099(models.TextChoices):
        NEC = "NEC", "1099-NEC"
        INT = "INT", "1099-INT"
        DIV = "DIV", "1099-DIV"
        G = "G", "1099-G"
        R = "R", "1099-R"
        MISC = "MISC", "1099-MISC"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tax_return = models.ForeignKey(TaxReturn, on_delete=models.CASCADE, related_name="ten99s")
    form_type = models.CharField(max_length=10, choices=Type1099.choices)
    payer_name = models.CharField(max_length=255, blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    federal_withheld = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    qualified_dividends = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "income_1099_entries"
