from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsOwnerOrPreparer, IsTaxPreparer, IsAdmin
from audit.utils import log_action
from .models import TaxProfile, Dependent
from .serializers import TaxProfileSerializer, TaxProfileWriteSerializer, DependentSerializer


class TaxProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return TaxProfileWriteSerializer
        return TaxProfileSerializer

    def get_object(self):
        profile, _ = TaxProfile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        serializer.save()
        log_action(self.request.user, "UPDATE", "TaxProfile",
                   serializer.instance.id, self.request)


class DependentViewSet(viewsets.ModelViewSet):
    serializer_class = DependentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        profile, _ = TaxProfile.objects.get_or_create(user=self.request.user)
        return Dependent.objects.filter(tax_profile=profile)

    def perform_create(self, serializer):
        profile, _ = TaxProfile.objects.get_or_create(user=self.request.user)
        serializer.save(tax_profile=profile)
        log_action(self.request.user, "CREATE", "Dependent",
                   serializer.instance.id, self.request)

    def perform_destroy(self, instance):
        log_action(self.request.user, "DELETE", "Dependent", instance.id, self.request)
        instance.delete()


class PreparerClientListView(generics.ListAPIView):
    """Tax preparers can list their assigned clients."""
    serializer_class = TaxProfileSerializer
    permission_classes = [IsTaxPreparer]

    def get_queryset(self):
        from returns.models import TaxReturn
        client_ids = TaxReturn.objects.filter(
            preparer=self.request.user
        ).values_list("user_id", flat=True).distinct()
        return TaxProfile.objects.filter(user_id__in=client_ids)
