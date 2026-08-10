import random
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction as db_transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from config.settings import DEFAULT_FROM_EMAIL
from .models import Account, Customer, PasswordResetOtp, RegistrationOtp, Transaction
from .serializers import (
    AccountCreateSerializer,
    AccountSerializer,
    CustomerSerializer,
    DepositWithdrawSerializer,
    ForgotPasswordSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    TransactionSerializer,
    TransferSerializer,
    VerifyRegistrationSerializer,
)


class RegisterView(APIView):
    """Public endpoint: send an OTP to the email address before creating the account."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        registration_payload = serializer.validated_data.copy()
        otp_code = f"{random.randint(100000, 999999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        RegistrationOtp.objects.filter(email=registration_payload["email"]).delete()
        RegistrationOtp.objects.create(
            email=registration_payload["email"],
            otp=otp_code,
            payload=registration_payload,
            expires_at=expires_at,
        )

        send_mail(
            subject="MAP Bank account verification",
            message=(
                f"Your MAP Bank verification code is {otp_code}. "
                "Enter it in the app to finish creating your account."
            ),
            from_email=DEFAULT_FROM_EMAIL,
            recipient_list=["backupbenji22@gmail.com"],
        )

        return Response({"detail": "A verification code was sent to your email."}, status=status.HTTP_200_OK)


class VerifyRegistrationView(APIView):
    """Validate the OTP and create the user + customer profile."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]

        registration = (
            RegistrationOtp.objects.filter(email=email, used=False, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        if not registration or registration.otp != otp:
            return Response({"detail": "Invalid or expired verification code."}, status=status.HTTP_400_BAD_REQUEST)

        payload = registration.payload
        user = User.objects.create_user(
            username=payload["username"],
            email=payload["email"],
            password=payload["password"],
            first_name=payload.get("first_name", ""),
            last_name=payload.get("last_name", ""),
        )
        Customer.objects.create(user=user, phone=payload["phone"], id_number=payload["id_number"])
        registration.used = True
        registration.save(update_fields=["used"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {"access": str(refresh.access_token), "refresh": str(refresh)},
            status=status.HTTP_201_CREATED,
        )


class ForgotPasswordView(APIView):
    """Send an OTP to recover a forgotten password."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp_code = f"{random.randint(100000, 999999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        PasswordResetOtp.objects.filter(email=email).delete()
        PasswordResetOtp.objects.create(email=email, otp=otp_code, expires_at=expires_at)

        send_mail(
            subject="MAP Bank password reset",
            message=(
                f"Your MAP Bank password reset code is {otp_code}. "
                "Enter it in the app to choose a new password."
            ),
            from_email=DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )

        return Response({"detail": "A password reset code was sent to your email."}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """Validate the OTP and set a new password for the user."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]
        password = serializer.validated_data["password"]

        reset_request = (
            PasswordResetOtp.objects.filter(email=email, used=False, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        if not reset_request or reset_request.otp != otp:
            return Response({"detail": "Invalid or expired reset code."}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(User, email=email)
        user.set_password(password)
        user.save(update_fields=["password"])

        reset_request.used = True
        reset_request.save(update_fields=["used"])

        return Response({"detail": "Your password was reset successfully."}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Blacklists the refresh token so it can no longer be used to mint new access tokens."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({"detail": "Invalid or already-expired token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    """Returns the profile of the currently authenticated customer."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        customer = get_object_or_404(Customer, user=request.user)
        return Response(CustomerSerializer(customer).data)


class AccountViewSet(viewsets.ModelViewSet):
    """
    CRUD for the logged-in customer's own accounts, plus money-movement actions.
    Only GET/POST are allowed - accounts can't be edited or deleted through the API.
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head"]

    def get_queryset(self):
        # Scoped to the requesting user so nobody can enumerate/access another
        # customer's accounts by guessing IDs (IDOR protection).
        return Account.objects.filter(customer__user=self.request.user).order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return AccountCreateSerializer
        return AccountSerializer

    def perform_create(self, serializer):
        customer = get_object_or_404(Customer, user=self.request.user)
        serializer.save(customer=customer)

    def create(self, request, *args, **kwargs):
        # AccountCreateSerializer only exposes `account_type` (write side),
        # so build the response from AccountSerializer to include the
        # generated account_number/balance/created_at instead of echoing
        # back just the input.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output_serializer = AccountSerializer(serializer.instance)
        headers = self.get_success_headers(output_serializer.data)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def get_owned_account_for_update(self, pk, request):
        """Fetch + row-lock an account, scoped to the requester, or 404."""
        return get_object_or_404(
            Account.objects.select_for_update(), pk=pk, customer__user=request.user
        )

    @action(detail=True, methods=["post"])
    def deposit(self, request, pk=None):
        serializer = DepositWithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        with db_transaction.atomic():
            account = self.get_owned_account_for_update(pk, request)
            account.balance += amount
            account.save(update_fields=["balance"])

            txn = Transaction.objects.create(
                account=account,
                transaction_type="DEPOSIT",
                amount=amount,
                balance_after=account.balance,
                description="Deposit",
            )

        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        serializer = DepositWithdrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        with db_transaction.atomic():
            account = self.get_owned_account_for_update(pk, request)

            if account.balance < amount:
                return Response({"detail": "Insufficient funds."}, status=status.HTTP_400_BAD_REQUEST)

            account.balance -= amount
            account.save(update_fields=["balance"])

            txn = Transaction.objects.create(
                account=account,
                transaction_type="WITHDRAWAL",
                amount=amount,
                balance_after=account.balance,
                description="Withdrawal",
            )

        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        serializer = TransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        to_account_number = serializer.validated_data["to_account_number"]

        with db_transaction.atomic():
            from_account = self.get_owned_account_for_update(pk, request)

            to_account_unlocked = Account.objects.filter(account_number=to_account_number).first()
            if to_account_unlocked is None:
                return Response({"detail": "Destination account not found."}, status=status.HTTP_404_NOT_FOUND)

            if from_account.pk == to_account_unlocked.pk:
                return Response(
                    {"detail": "Cannot transfer to the same account."}, status=status.HTTP_400_BAD_REQUEST
                )

            # Lock both accounts in a stable pk order to avoid deadlocks when two
            # transfers happen between the same pair of accounts in opposite directions.
            lock_order = sorted([from_account.pk, to_account_unlocked.pk])
            locked = {
                acc.pk: acc
                for acc in Account.objects.select_for_update().filter(pk__in=lock_order)
            }
            from_account = locked[from_account.pk]
            to_account = locked[to_account_unlocked.pk]

            if from_account.balance < amount:
                return Response({"detail": "Insufficient funds."}, status=status.HTTP_400_BAD_REQUEST)

            from_account.balance -= amount
            to_account.balance += amount
            from_account.save(update_fields=["balance"])
            to_account.save(update_fields=["balance"])

            out_txn = Transaction.objects.create(
                account=from_account,
                transaction_type="TRANSFER_OUT",
                amount=amount,
                balance_after=from_account.balance,
                related_account=to_account,
                description=f"Transfer to {to_account.account_number}",
            )
            Transaction.objects.create(
                account=to_account,
                transaction_type="TRANSFER_IN",
                amount=amount,
                balance_after=to_account.balance,
                related_account=from_account,
                description=f"Transfer from {from_account.account_number}",
            )

        return Response(TransactionSerializer(out_txn).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def transactions(self, request, pk=None):
        account = get_object_or_404(Account, pk=pk, customer__user=request.user)
        txns = account.transactions.all()
        page = self.paginate_queryset(txns)
        if page is not None:
            return self.get_paginated_response(TransactionSerializer(page, many=True).data)
        return Response(TransactionSerializer(txns, many=True).data)


class TransactionListView(generics.ListAPIView):
    """Combined, paginated transaction history across ALL of the customer's accounts."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(account__customer__user=self.request.user).select_related(
            "account", "related_account"
        )