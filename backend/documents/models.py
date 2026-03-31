import uuid
from django.db import models
from django.conf import settings


def client_upload_path(instance, filename):
    return f"clients/{instance.user.id}/tax_year/{instance.tax_year}/{filename}"


class Document(models.Model):
    class DocType(models.TextChoices):
        W2 = "W2", "W-2"
        TEN99_NEC = "1099_NEC", "1099-NEC"
        TEN99_INT = "1099_INT", "1099-INT"
        TEN99_DIV = "1099_DIV", "1099-DIV"
        TEN99_G = "1099_G", "1099-G"
        TEN99_R = "1099_R", "1099-R"
        TEN99_MISC = "1099_MISC", "1099-MISC"
        TEN98 = "1098", "1098"
        K1 = "K1", "Schedule K-1"
        ID_FRONT = "ID_FRONT", "ID (Front)"
        ID_BACK = "ID_BACK", "ID (Back)"
        OTHER = "OTHER", "Other"

    class ScanStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Scan"
        CLEAN = "CLEAN", "Clean"
        INFECTED = "INFECTED", "Infected"
        ERROR = "ERROR", "Scan Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="documents"
    )
    tax_year = models.PositiveIntegerField()
    doc_type = models.CharField(max_length=20, choices=DocType.choices)
    file = models.FileField(upload_to=client_upload_path)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, default="")
    scan_status = models.CharField(
        max_length=10, choices=ScanStatus.choices, default=ScanStatus.PENDING
    )
    description = models.TextField(blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "documents"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.doc_type} - {self.original_filename}"
