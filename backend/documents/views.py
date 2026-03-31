from rest_framework import viewsets, status, parsers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsOwnerOrPreparer
from audit.utils import log_action
from .models import Document
from .serializers import DocumentSerializer, DocumentUploadSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrPreparer]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    filterset_fields = ["tax_year", "doc_type", "scan_status"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "ADMIN":
            return Document.objects.all()
        if user.role == "TAX_PREPARER":
            from returns.models import TaxReturn
            client_ids = TaxReturn.objects.filter(
                preparer=user
            ).values_list("user_id", flat=True)
            return Document.objects.filter(user_id__in=client_ids) | Document.objects.filter(user=user)
        return Document.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        uploaded_file = data["file"]

        doc = Document.objects.create(
            user=request.user,
            tax_year=data["tax_year"],
            doc_type=data["doc_type"],
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            mime_type=uploaded_file.content_type or "",
            description=data.get("description", ""),
        )

        # Trigger async virus scan
        from documents.tasks import scan_document
        scan_document.delay(str(doc.id))

        log_action(request.user, "UPLOAD", "Document", doc.id, request,
                   {"filename": uploaded_file.name, "doc_type": data["doc_type"]})

        return Response(DocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        log_action(self.request.user, "DELETE", "Document", instance.id, self.request)
        # Delete from S3
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        doc = self.get_object()
        if doc.scan_status != "CLEAN":
            return Response({"error": "File has not passed security scan."},
                            status=status.HTTP_403_FORBIDDEN)
        log_action(request.user, "DOWNLOAD", "Document", doc.id, request)
        # Return signed URL (S3) or file URL
        return Response({"url": doc.file.url})
