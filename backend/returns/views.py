import json
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsOwnerOrPreparer, IsTaxPreparer, IsAdmin
from audit.utils import log_action
from .models import TaxReturn, ReturnStatusHistory, W2Entry, Income1099
from .serializers import (
    TaxReturnListSerializer, TaxReturnDetailSerializer,
    TaxReturnCreateSerializer, TaxReturnUpdateSerializer,
    StatusUpdateSerializer, W2EntrySerializer, Income1099Serializer,
)
from .tax_engine import calculate_return


class TaxReturnViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrPreparer]
    filterset_fields = ["tax_year", "status"]
    ordering_fields = ["tax_year", "created_at", "updated_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return TaxReturnListSerializer
        if self.action == "create":
            return TaxReturnCreateSerializer
        if self.action in ("update", "partial_update"):
            return TaxReturnUpdateSerializer
        return TaxReturnDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "ADMIN":
            return TaxReturn.objects.all()
        if user.role == "TAX_PREPARER":
            return TaxReturn.objects.filter(preparer=user) | TaxReturn.objects.filter(user=user)
        return TaxReturn.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        serializer = TaxReturnCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Check uniqueness
        if TaxReturn.objects.filter(user=request.user, tax_year=data["tax_year"]).exists():
            return Response({"error": f"A return for {data['tax_year']} already exists."},
                            status=status.HTTP_400_BAD_REQUEST)

        form_data = {}
        # Copy from prior year if requested
        if data.get("copy_from_year"):
            try:
                prior = TaxReturn.objects.get(user=request.user, tax_year=data["copy_from_year"])
                form_data = json.loads(prior.form_data) if prior.form_data else {}
            except TaxReturn.DoesNotExist:
                pass

        tax_return = TaxReturn.objects.create(
            user=request.user,
            tax_year=data["tax_year"],
            filing_status=data.get("filing_status", ""),
            form_data=json.dumps(form_data),
        )
        ReturnStatusHistory.objects.create(
            tax_return=tax_return, new_status="INTAKE", changed_by=request.user
        )
        log_action(request.user, "CREATE", "TaxReturn", tax_return.id, request)
        return Response(TaxReturnDetailSerializer(tax_return).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        tax_return = self.get_object()
        serializer = TaxReturnUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "form_data" in data:
            tax_return.form_data = json.dumps(data["form_data"])
        if "filing_status" in data:
            tax_return.filing_status = data["filing_status"]

        # Upsert W-2s
        if "w2s" in data:
            tax_return.w2s.all().delete()
            for w2_data in data["w2s"]:
                W2Entry.objects.create(tax_return=tax_return, **w2_data)

        # Upsert 1099s
        if "ten99s" in data:
            tax_return.ten99s.all().delete()
            for t_data in data["ten99s"]:
                Income1099.objects.create(tax_return=tax_return, **t_data)

        tax_return.save()
        log_action(request.user, "UPDATE", "TaxReturn", tax_return.id, request)
        return Response(TaxReturnDetailSerializer(tax_return).data)

    @action(detail=True, methods=["post"])
    def calculate(self, request, pk=None):
        """Run tax engine on current form_data and store result."""
        tax_return = self.get_object()
        try:
            form_data = json.loads(tax_return.form_data) if tax_return.form_data else {}
        except json.JSONDecodeError:
            form_data = {}

        # Merge W2 and 1099 data from related models
        form_data["filing_status"] = tax_return.filing_status
        form_data["w2s"] = list(tax_return.w2s.values(
            "wages", "federal_withheld", "state_withheld",
            "ss_wages", "ss_withheld", "medicare_wages", "medicare_withheld"
        ))
        # Aggregate 1099s into form_data
        for entry in tax_return.ten99s.all():
            key_map = {
                "NEC": "income_1099_nec", "INT": "income_1099_int",
                "DIV": "income_1099_div", "G": "income_1099_g",
                "R": "income_1099_r", "MISC": "income_1099_misc",
            }
            key = key_map.get(entry.form_type)
            if key:
                form_data[key] = float(form_data.get(key, 0)) + float(entry.amount)

        result = calculate_return(form_data)
        tax_return.computed_result = json.dumps(result)
        tax_return.save(update_fields=["computed_result"])

        log_action(request.user, "VIEW", "TaxReturn", tax_return.id, request,
                   {"action": "calculate"})
        return Response(result)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Submit return for review. Triggers calculation first."""
        tax_return = self.get_object()
        if tax_return.status not in ("INTAKE", "DOCUMENTS_RECEIVED", "CLIENT_REVIEW"):
            return Response({"error": "Return cannot be submitted in its current status."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Auto-calculate before submit
        self.calculate(request, pk)
        tax_return.refresh_from_db()

        old_status = tax_return.status
        tax_return.status = "UNDER_REVIEW"
        tax_return.submitted_at = timezone.now()
        tax_return.save(update_fields=["status", "submitted_at"])

        ReturnStatusHistory.objects.create(
            tax_return=tax_return, old_status=old_status,
            new_status="UNDER_REVIEW", changed_by=request.user,
        )
        log_action(request.user, "UPDATE", "TaxReturn", tax_return.id, request,
                   {"action": "submit"})
        return Response({"message": "Return submitted for review.", "status": tax_return.status})

    @action(detail=True, methods=["post"], permission_classes=[IsTaxPreparer])
    def update_status(self, request, pk=None):
        """Preparer/admin updates return status."""
        tax_return = self.get_object()
        serializer = StatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = tax_return.status
        new_status = serializer.validated_data["status"]
        tax_return.status = new_status
        tax_return.save(update_fields=["status"])

        ReturnStatusHistory.objects.create(
            tax_return=tax_return, old_status=old_status,
            new_status=new_status, changed_by=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        log_action(request.user, "UPDATE", "TaxReturn", tax_return.id, request,
                   {"old_status": old_status, "new_status": new_status})
        return Response({"message": f"Status updated to {new_status}.", "status": new_status})

    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        """Export return as JSON."""
        tax_return = self.get_object()
        log_action(request.user, "EXPORT", "TaxReturn", tax_return.id, request)
        return Response({
            "tax_year": tax_return.tax_year,
            "status": tax_return.status,
            "filing_status": tax_return.filing_status,
            "form_data": json.loads(tax_return.form_data) if tax_return.form_data else {},
            "computed_result": json.loads(tax_return.computed_result) if tax_return.computed_result else {},
            "submitted_at": tax_return.submitted_at,
        })
