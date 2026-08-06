from django.db import transaction as db_transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import Account, Customer, Transaction
from .serializers import (
    AccountCreateSerializer,
    AccountSerializer,
    CustomerSerializer,
    DepositWithdrawSerializer,
    RegisterSerializer,
    TransactionSerializer,
    TransferSerializer,
)


class RegisterView(generics.CreateAPIView):
    """Public endpoint: create a User + linked Customer profile."""

    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


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