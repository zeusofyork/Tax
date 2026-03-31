import json
import zipfile
import tempfile
import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task
def send_email_task(subject, message, recipient_list):
    """Async email sending to avoid blocking requests."""
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipient_list,
        fail_silently=False,
    )


@shared_task
def export_user_data(user_id):
    """
    GDPR/CCPA data export: compile all user data into a ZIP file.
    Returns the path to the generated file.
    """
    from clients.models import TaxProfile, Dependent
    from returns.models import TaxReturn
    from invoices.models import Invoice
    from documents.models import Document

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for data export.")
        return None

    export_data = {
        "user": {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "role": user.role,
            "date_joined": str(user.date_joined),
        },
        "tax_profile": None,
        "dependents": [],
        "tax_returns": [],
        "invoices": [],
        "documents": [],
    }

    # Tax profile
    try:
        profile = user.tax_profile
        export_data["tax_profile"] = {
            "ssn_last4": profile.ssn_last4,
            "date_of_birth": profile.date_of_birth,
            "address": f"{profile.address_street}, {profile.city}, {profile.state} {profile.zip_code}",
            "filing_status": profile.filing_status,
        }
        for dep in profile.dependents.all():
            export_data["dependents"].append({
                "name": dep.name,
                "relationship": dep.relationship,
                "date_of_birth": dep.date_of_birth,
            })
    except TaxProfile.DoesNotExist:
        pass

    # Returns
    for ret in TaxReturn.objects.filter(user=user):
        export_data["tax_returns"].append({
            "tax_year": ret.tax_year,
            "status": ret.status,
            "filing_status": ret.filing_status,
            "form_data": json.loads(ret.form_data) if ret.form_data else {},
            "computed_result": json.loads(ret.computed_result) if ret.computed_result else {},
            "submitted_at": str(ret.submitted_at) if ret.submitted_at else None,
        })

    # Invoices
    for inv in Invoice.objects.filter(user=user):
        export_data["invoices"].append({
            "invoice_number": inv.invoice_number,
            "status": inv.status,
            "total": str(inv.total),
            "due_date": str(inv.due_date),
            "paid_at": str(inv.paid_at) if inv.paid_at else None,
        })

    # Documents list
    for doc in Document.objects.filter(user=user):
        export_data["documents"].append({
            "doc_type": doc.doc_type,
            "original_filename": doc.original_filename,
            "tax_year": doc.tax_year,
            "uploaded_at": str(doc.uploaded_at),
        })

    # Write to temp ZIP
    with tempfile.NamedTemporaryFile(
        prefix=f"export_{user_id}_",
        suffix=".zip",
        delete=False,
    ) as tmp:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("user_data.json", json.dumps(export_data, indent=2, default=str))
        return tmp.name


@shared_task
def purge_deleted_accounts():
    """
    Hard-delete accounts that were soft-deleted more than 30 days ago.
    Anonymizes PII but retains financial records for 7 years.
    """
    cutoff = timezone.now() - timezone.timedelta(days=30)
    users = User.objects.filter(deleted_at__lte=cutoff, is_active=False)

    for user in users:
        logger.info(f"Purging account: {user.id}")
        # Anonymize PII
        user.email = f"deleted_{user.id}@purged.local"
        user.first_name = "DELETED"
        user.last_name = "DELETED"
        user.phone = ""
        user.mfa_secret = ""
        user.mfa_backup_codes = []
        user.trusted_devices = []
        user.set_unusable_password()
        user.save()

        # Anonymize tax profile
        try:
            profile = user.tax_profile
            profile.ssn_last4 = ""
            profile.date_of_birth = ""
            profile.address_street = ""
            profile.phone = ""
            profile.save()
            profile.dependents.all().delete()
        except Exception:
            pass

        # Delete uploaded documents from S3
        from documents.models import Document
        for doc in Document.objects.filter(user=user):
            doc.file.delete(save=False)
            doc.delete()

        # Keep returns and invoices for 7-year IRS retention (data is encrypted)
        logger.info(f"Account {user.id} purged. Financial records retained.")
