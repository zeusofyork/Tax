from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"dependents", views.DependentViewSet, basename="dependent")

urlpatterns = [
    path("profile/", views.TaxProfileView.as_view(), name="tax-profile"),
    path("preparer/clients/", views.PreparerClientListView.as_view(), name="preparer-clients"),
    path("", include(router.urls)),
]
