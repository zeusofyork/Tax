import uuid
import json
import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from accounts.permissions import IsTaxPreparer, IsAdmin, IsOwnerOrPreparer
from audit.utils import log_action
from .models import Invoice, InvoiceLineItem
from .serializers import InvoiceSerializer, InvoiceCreateSerializer

User = get_user_model()
stripe.api_key = settings.STRIPE_SECRET_KEY


def generate_invoice_number():
    return f"INV-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "ADMIN":
            return Invoice.objects.all()
        if user.role == "TAX_PREPARER":
            return Invoice.objects.filter(created_by=user) | Invoice.objects.filter(user=user)
        return Invoice.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        """Tax preparer creates an invoice for a client."""
        if request.user.role not in ("TAX_PREPARER", "ADMIN"):
            return Response({"error": "Only preparers can create invoices."},
                            status=status.HTTP_403_FORBIDDEN)

        serializer = InvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            client = User.objects.get(id=data["client_user_id"], role="CLIENT")
        except User.DoesNotExist:
            return Response({"error": "Client not found."}, status=status.HTTP_404_NOT_FOUND)

        invoice = Invoice.objects.create(
            user=client,
            created_by=request.user,
            tax_return_id=data.get("tax_return_id"),
            invoice_number=generate_invoice_number(),
            due_date=data["due_date"],
            tax_amount=data.get("tax_amount", 0),
            notes=data.get("notes", ""),
        )

        for item_data in data["line_items"]:
            InvoiceLineItem.objects.create(
                invoice=invoice,
                description=item_data["description"],
                quantity=item_data.get("quantity", 1),
                unit_price=item_data["unit_price"],
                amount=item_data.get("quantity", 1) * item_data["unit_price"],
            )

        invoice.calculate_total()
        log_action(request.user, "CREATE", "Invoice", invoice.id, request,
                   {"client": str(client.id), "total": str(invoice.total)})
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsTaxPreparer])
    def send_invoice(self, request, pk=None):
        """Create Stripe invoice and send to client."""
        invoice = self.get_object()
        client = invoice.user

        if not client.stripe_customer_id:
            # Create Stripe customer on the fly
            try:
                customer = stripe.Customer.create(
                    email=client.email,
                    name=client.full_name,
                    metadata={"user_id": str(client.id)},
                )
                client.stripe_customer_id = customer.id
                client.save(update_fields=["stripe_customer_id"])
            except stripe.error.StripeError as e:
                return Response({"error": f"Stripe error: {str(e)}"},
                                status=status.HTTP_502_BAD_GATEWAY)

        try:
            # Create Stripe invoice
            stripe_invoice = stripe.Invoice.create(
                customer=client.stripe_customer_id,
                collection_method="send_invoice",
                days_until_due=max(1, (invoice.due_date - timezone.now().date()).days),
                metadata={"invoice_id": str(invoice.id)},
            )

            # Add line items
            for item in invoice.line_items.all():
                stripe.InvoiceItem.create(
                    customer=client.stripe_customer_id,
                    invoice=stripe_invoice.id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_amount=int(item.unit_price * 100),  # Stripe uses cents
                    currency="usd",
                )

            # Add tax if any
            if invoice.tax_amount > 0:
                stripe.InvoiceItem.create(
                    customer=client.stripe_customer_id,
                    invoice=stripe_invoice.id,
                    description="Tax",
                    amount=int(invoice.tax_amount * 100),
                    currency="usd",
                )

            # Finalize and send
            stripe_invoice = stripe.Invoice.finalize_invoice(stripe_invoice.id)
            stripe.Invoice.send_invoice(stripe_invoice.id)

            invoice.stripe_invoice_id = stripe_invoice.id
            invoice.stripe_hosted_url = stripe_invoice.hosted_invoice_url or ""
            invoice.status = "SENT"
            invoice.sent_at = timezone.now()
            invoice.save(update_fields=[
                "stripe_invoice_id", "stripe_hosted_url", "status", "sent_at"
            ])

            log_action(request.user, "INVOICE_SENT", "Invoice", invoice.id, request)
            return Response({
                "message": "Invoice sent successfully.",
                "hosted_url": invoice.stripe_hosted_url,
            })
        except stripe.error.StripeError as e:
            return Response({"error": f"Stripe error: {str(e)}"},
                            status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        """Void an invoice."""
        if request.user.role not in ("TAX_PREPARER", "ADMIN"):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object()
        if invoice.status == "PAID":
            return Response({"error": "Cannot void a paid invoice."},
                            status=status.HTTP_400_BAD_REQUEST)

        if invoice.stripe_invoice_id:
            try:
                stripe.Invoice.void_invoice(invoice.stripe_invoice_id)
            except stripe.error.StripeError:
                pass

        invoice.status = "VOID"
        invoice.save(update_fields=["status"])
        log_action(request.user, "UPDATE", "Invoice", invoice.id, request, {"action": "void"})
        return Response({"message": "Invoice voided."})


# ==================== STRIPE WEBHOOK ====================

@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        return HttpResponse(status=400)

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "invoice.paid":
        _handle_invoice_paid(data)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data)
    elif event_type == "invoice.viewed":
        _handle_invoice_viewed(data)

    return HttpResponse(status=200)


def _handle_invoice_paid(stripe_invoice):
    invoice_id = stripe_invoice.get("metadata", {}).get("invoice_id")
    if not invoice_id:
        return
    try:
        invoice = Invoice.objects.get(id=invoice_id)
    except Invoice.DoesNotExist:
        return
    if invoice.status == "PAID":
        return  # Idempotency check

    invoice.status = "PAID"
    invoice.paid_at = timezone.now()
    invoice.stripe_payment_intent_id = stripe_invoice.get("payment_intent", "")
    invoice.save(update_fields=["status", "paid_at", "stripe_payment_intent_id"])
    log_action(invoice.user, "PAYMENT", "Invoice", invoice.id, metadata={
        "amount": str(invoice.total), "stripe_invoice_id": stripe_invoice.get("id")
    })


def _handle_payment_failed(stripe_invoice):
    invoice_id = stripe_invoice.get("metadata", {}).get("invoice_id")
    if not invoice_id:
        return
    try:
        invoice = Invoice.objects.get(id=invoice_id)
    except Invoice.DoesNotExist:
        return
    # Keep status as SENT but log failure
    log_action(invoice.user, "PAYMENT", "Invoice", invoice.id, metadata={
        "event": "payment_failed", "stripe_invoice_id": stripe_invoice.get("id")
    })


def _handle_invoice_viewed(stripe_invoice):
    invoice_id = stripe_invoice.get("metadata", {}).get("invoice_id")
    if not invoice_id:
        return
    try:
        invoice = Invoice.objects.get(id=invoice_id)
        if invoice.status == "SENT":
            invoice.status = "VIEWED"
            invoice.save(update_fields=["status"])
    except Invoice.DoesNotExist:
        pass
