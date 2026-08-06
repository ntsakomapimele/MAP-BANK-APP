from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from .views import RegisterView, LogoutView, MeView, AccountViewSet, TransactionListView

router = DefaultRouter()
router.register("accounts", AccountViewSet, basename="account")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("transactions/", TransactionListView.as_view(), name="transaction-list"),
    path("", include(router.urls)),
]
