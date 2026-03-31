from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"", views.InvoiceViewSet, basename="invoice")

urlpatterns = [
    path("webhooks/stripe/", views.stripe_webhook, name="stripe-webhook"),
    path("", include(router.urls)),
]
