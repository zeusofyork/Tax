import uuid
from django.db import models
from django.conf import settings
from encrypted_model_fields.fields import EncryptedCharField


class TaxProfile(models.Model):
    class FilingStatus(models.TextChoices):
        SINGLE = "SINGLE", "Single"
        MFJ = "MFJ", "Married Filing Jointly"
        MFS = "MFS", "Married Filing Separately"
        HOH = "HOH", "Head of Household"
        QW = "QW", "Qualifying Surviving Spouse"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tax_profile"
    )
    # PII — encrypted at rest
    ssn_last4 = EncryptedCharField(max_length=4, blank=True, default="")
    date_of_birth = EncryptedCharField(max_length=10, blank=True, default="")
    address_street = EncryptedCharField(max_length=255, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=2, blank=True, default="")
    zip_code = models.CharField(max_length=10, blank=True, default="")

    filing_status = models.CharField(
        max_length=10, choices=FilingStatus.choices, blank=True, default=""
    )
    employer_name = models.CharField(max_length=255, blank=True, default="")
    w2_count = models.PositiveIntegerField(default=0)
    ten99_count = models.PositiveIntegerField(default=0)
    prior_year_agi = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tax_profiles"

    def __str__(self):
        return f"TaxProfile for {self.user.email}"

    @property
    def ssn_masked(self):
        if self.ssn_last4:
            return f"***-**-{self.ssn_last4}"
        return ""


class Dependent(models.Model):
    class Relationship(models.TextChoices):
        SON = "SON", "Son"
        DAUGHTER = "DAUGHTER", "Daughter"
        STEPCHILD = "STEPCHILD", "Stepchild"
        FOSTER = "FOSTER", "Foster Child"
        SIBLING = "SIBLING", "Sibling"
        PARENT = "PARENT", "Parent"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tax_profile = models.ForeignKey(
        TaxProfile, on_delete=models.CASCADE, related_name="dependents"
    )
    name = EncryptedCharField(max_length=255)
    ssn_last4 = EncryptedCharField(max_length=4, blank=True, default="")
    date_of_birth = EncryptedCharField(max_length=10, blank=True, default="")
    relationship = models.CharField(
        max_length=20, choices=Relationship.choices, default=Relationship.OTHER
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dependents"

    def __str__(self):
        return f"Dependent: {self.relationship}"
