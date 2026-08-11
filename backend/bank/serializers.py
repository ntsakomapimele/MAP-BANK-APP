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
        if not value.isdigit() or len(value) != 13:
            raise serializers.ValidationError("ID number must be exactly 13 digits.")
        if Customer.objects.filter(id_number=value).exists():
            raise serializers.ValidationError("A customer with this ID number already exists.")
        return value

    def validate_phone(self, value):
        # Accept digits only, exactly 10 digits (e.g., local number without country code)
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        return value


class VerifyRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No account exists for this email.")
        return value


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    password = serializers.CharField(write_only=True, validators=[validate_password])


class CustomerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = Customer
        fields = ["id", "username", "email", "first_name", "last_name", "id_number", "phone", "created_at"]


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)

    class Meta:
        model = Customer
        fields = ["id", "username", "email", "first_name", "last_name", "id_number", "phone"]

    def validate_email(self, value):
        user = self.instance.user if self.instance else None
        if User.objects.filter(email=value).exclude(pk=user.pk if user else None).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_id_number(self, value):
        if Customer.objects.filter(id_number=value).exclude(pk=self.instance.pk if self.instance else None).exists():
            raise serializers.ValidationError("A customer with this ID number already exists.")
        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        for field, value in user_data.items():
            setattr(user, field, value)
        if user_data:
            user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


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


class AirtimeSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("1000000"))

    def validate_phone_number(self, value):
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        return value


class ElectricitySerializer(serializers.Serializer):
    meter_number = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("1000000"))

    def validate_meter_number(self, value):
        if not value or len(value.strip()) < 3:
            raise serializers.ValidationError("Meter number is required and must be at least 3 characters.")
        return value.strip()