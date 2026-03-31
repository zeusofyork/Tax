import subprocess
import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def scan_document(self, document_id):
    """
    Virus scan an uploaded document using ClamAV (clamscan).
    Falls back to marking as CLEAN if ClamAV is not available (dev mode).
    """
    from documents.models import Document

    try:
        doc = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.warning(f"Document {document_id} not found for scanning.")
        return

    file_path = doc.file.path if hasattr(doc.file, "path") else None

    if not file_path:
        # S3-stored file — download to temp for scanning
        import tempfile
        import boto3

        s3 = boto3.client("s3")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
            try:
                s3.download_fileobj(
                    settings.AWS_STORAGE_BUCKET_NAME,
                    doc.file.name,
                    tmp,
                )
                file_path = tmp.name
            except Exception as e:
                logger.error(f"Failed to download {doc.file.name} from S3: {e}")
                doc.scan_status = "ERROR"
                doc.save(update_fields=["scan_status"])
                return

    try:
        result = subprocess.run(
            ["clamscan", "--no-summary", file_path],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0:
            doc.scan_status = "CLEAN"
        elif result.returncode == 1:
            doc.scan_status = "INFECTED"
            logger.warning(f"INFECTED file detected: {doc.id} - {doc.original_filename}")
            # Delete infected file
            doc.file.delete(save=False)
        else:
            doc.scan_status = "ERROR"
            logger.error(f"ClamAV error for {doc.id}: {result.stderr}")
    except FileNotFoundError:
        # ClamAV not installed — mark clean in dev
        if settings.DEBUG:
            doc.scan_status = "CLEAN"
            logger.info(f"ClamAV not available (dev mode). Marking {doc.id} as CLEAN.")
        else:
            doc.scan_status = "ERROR"
            logger.error("ClamAV (clamscan) not found on system.")
    except subprocess.TimeoutExpired:
        doc.scan_status = "ERROR"
        logger.error(f"ClamAV scan timed out for {doc.id}")
    except Exception as e:
        logger.error(f"Scan error for {doc.id}: {e}")
        doc.scan_status = "ERROR"

    doc.save(update_fields=["scan_status"])
