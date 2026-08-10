from decimal import Decimal

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Customer
from .models import Account
from .models import Transaction


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    phone = serializers.CharField()
    id_number = serializers.CharField()

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_id_number(self, value):
        if Customer.objects.filter(id_number=value).exists():
            raise serializers.ValidationError("A customer with this ID number already exists.")
        return value


class VerifyRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)


class CustomerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = Customer
        fields = ["id", "username", "email", "first_name", "last_name", "id_number", "phone", "created_at"]



class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "account_number", "account_type", "balance", "created_at"]
        read_only_fields = ["account_number", "balance", "created_at"]


class AccountCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["account_type"]



class TransactionSerializer(serializers.ModelSerializer):
    account_number = serializers.CharField(source="account.account_number", read_only=True)
    related_account_number = serializers.CharField(
        source="related_account.account_number", read_only=True, default=None
    )

    class Meta:
        model = Transaction
        fields = [
            "id",
            "account_number",
            "transaction_type",
            "amount",
            "balance_after",
            "related_account_number",
            "description",
            "created_at",
        ]


class DepositWithdrawSerializer(serializers.Serializer):
    # Hard ceiling on a single deposit/withdrawal to catch fat-finger amounts / abuse.
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("1000000"))


class TransferSerializer(serializers.Serializer):
    to_account_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("1000000"))