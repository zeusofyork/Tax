import json
from rest_framework import serializers
from .models import TaxReturn, ReturnStatusHistory, W2Entry, Income1099


class W2EntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = W2Entry
        fields = [
            "id", "employer_name", "employer_ein", "wages",
            "federal_withheld", "state_withheld", "ss_wages",
            "ss_withheld", "medicare_wages", "medicare_withheld",
        ]


class Income1099Serializer(serializers.ModelSerializer):
    class Meta:
        model = Income1099
        fields = [
            "id", "form_type", "payer_name", "amount",
            "federal_withheld", "qualified_dividends",
        ]


class ReturnStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.CharField(source="changed_by.email", read_only=True, default="")

    class Meta:
        model = ReturnStatusHistory
        fields = ["id", "old_status", "new_status", "changed_by_email", "note", "created_at"]


class TaxReturnListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no PII."""
    class Meta:
        model = TaxReturn
        fields = ["id", "tax_year", "status", "filing_status", "submitted_at", "created_at", "updated_at"]


class TaxReturnDetailSerializer(serializers.ModelSerializer):
    w2s = W2EntrySerializer(many=True, read_only=True)
    ten99s = Income1099Serializer(many=True, read_only=True)
    status_history = ReturnStatusHistorySerializer(many=True, read_only=True)
    computed_result = serializers.SerializerMethodField()

    class Meta:
        model = TaxReturn
        fields = [
            "id", "tax_year", "status", "filing_status",
            "form_data", "computed_result",
            "w2s", "ten99s", "status_history",
            "submitted_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "computed_result", "submitted_at", "created_at", "updated_at"]

    def get_computed_result(self, obj):
        try:
            return json.loads(obj.computed_result) if obj.computed_result else {}
        except (json.JSONDecodeError, TypeError):
            return {}


class TaxReturnCreateSerializer(serializers.Serializer):
    tax_year = serializers.IntegerField(min_value=2000, max_value=2099)
    filing_status = serializers.ChoiceField(
        choices=["SINGLE", "MFJ", "MFS", "HOH", "QW"], required=False, default=""
    )
    copy_from_year = serializers.IntegerField(required=False, allow_null=True, default=None)


class TaxReturnUpdateSerializer(serializers.Serializer):
    form_data = serializers.JSONField()
    filing_status = serializers.ChoiceField(
        choices=["SINGLE", "MFJ", "MFS", "HOH", "QW"], required=False
    )
    w2s = W2EntrySerializer(many=True, required=False)
    ten99s = Income1099Serializer(many=True, required=False)


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TaxReturn.Status.choices)
    note = serializers.CharField(required=False, default="")
