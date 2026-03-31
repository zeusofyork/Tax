from rest_framework import serializers
from .models import Invoice, InvoiceLineItem


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ["id", "description", "quantity", "unit_price", "amount"]
        read_only_fields = ["id", "amount"]


class InvoiceSerializer(serializers.ModelSerializer):
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    client_email = serializers.CharField(source="user.email", read_only=True)
    client_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "client_email", "client_name",
            "status", "subtotal", "tax_amount", "total", "due_date",
            "notes", "stripe_hosted_url", "line_items",
            "paid_at", "sent_at", "created_at",
        ]
        read_only_fields = [
            "id", "invoice_number", "subtotal", "total",
            "stripe_hosted_url", "paid_at", "sent_at", "created_at",
        ]


class InvoiceCreateSerializer(serializers.Serializer):
    client_user_id = serializers.UUIDField()
    tax_return_id = serializers.UUIDField(required=False, allow_null=True)
    due_date = serializers.DateField()
    tax_amount = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, default="")
    line_items = InvoiceLineItemSerializer(many=True)

    def validate_line_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one line item is required.")
        return value
