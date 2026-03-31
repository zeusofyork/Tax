from rest_framework import serializers
from .models import TaxProfile, Dependent


class DependentSerializer(serializers.ModelSerializer):
    ssn_masked = serializers.SerializerMethodField()

    class Meta:
        model = Dependent
        fields = ["id", "name", "ssn_last4", "ssn_masked", "date_of_birth", "relationship", "created_at"]
        extra_kwargs = {"ssn_last4": {"write_only": True}}

    def get_ssn_masked(self, obj):
        return f"***-**-{obj.ssn_last4}" if obj.ssn_last4 else ""


class TaxProfileSerializer(serializers.ModelSerializer):
    dependents = DependentSerializer(many=True, read_only=True)
    ssn_masked = serializers.ReadOnlyField()

    class Meta:
        model = TaxProfile
        fields = [
            "id", "ssn_last4", "ssn_masked", "date_of_birth",
            "address_street", "city", "state", "zip_code",
            "filing_status", "employer_name", "w2_count", "ten99_count",
            "prior_year_agi", "dependents", "created_at", "updated_at",
        ]
        extra_kwargs = {
            "ssn_last4": {"write_only": True},
            "date_of_birth": {"write_only": True},
        }


class TaxProfileWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxProfile
        fields = [
            "ssn_last4", "date_of_birth", "address_street", "city",
            "state", "zip_code", "filing_status", "employer_name",
            "w2_count", "ten99_count", "prior_year_agi",
        ]
