import magic
from rest_framework import serializers
from .models import Document

ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class DocumentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "tax_year", "doc_type", "original_filename",
            "file_size", "mime_type", "scan_status", "description",
            "uploaded_at", "download_url",
        ]
        read_only_fields = ["id", "original_filename", "file_size", "mime_type",
                            "scan_status", "uploaded_at", "download_url"]

    def get_download_url(self, obj):
        if obj.file and obj.scan_status == "CLEAN":
            return obj.file.url
        return None


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    tax_year = serializers.IntegerField(min_value=2000, max_value=2099)
    doc_type = serializers.ChoiceField(choices=Document.DocType.choices)
    description = serializers.CharField(required=False, default="")

    def validate_file(self, value):
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError("File size exceeds 10MB limit.")

        # Check MIME type server-side using python-magic
        file_mime = magic.from_buffer(value.read(2048), mime=True)
        value.seek(0)
        if file_mime not in ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f"File type '{file_mime}' is not allowed. Allowed: PDF, JPG, PNG."
            )
        return value
