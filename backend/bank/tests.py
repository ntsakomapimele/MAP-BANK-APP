import re
from decimal import Decimal

from django.contrib.auth.models import User
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Account, Customer, Transaction


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RegistrationTests(APITestCase):
    def test_register_sends_otp_and_creates_user_after_verification(self):
        url = reverse("register")
        payload = {
            "username": "alice",
            "email": "alice@example.com",
            "first_name": "Alice",
            "last_name": "Doe",
            "password": "SuperSecret123",
            "phone": "+15551234567",
            "id_number": "9001011234567",
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        otp_code = re.search(r"\d{6}", mail.outbox[0].body)
        self.assertIsNotNone(otp_code)
        otp_code = otp_code.group(0)
        verify_response = self.client.post(
            reverse("verify-registration"), {"email": payload["email"], "otp": otp_code}
        )
        self.assertEqual(verify_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="alice").exists())
        customer = Customer.objects.get(user__username="alice")
        self.assertEqual(customer.id_number, "9001011234567")
        self.assertEqual(customer.phone, "+15551234567")

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(username="bob", email="dupe@example.com", password="SuperSecret123")
        url = reverse("register")
        payload = {
            "username": "bob2",
            "email": "dupe@example.com",
            "password": "SuperSecret123",
            "phone": "+15551234567",
            "id_number": "9002021234567",
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_rejects_weak_password(self):
        url = reverse("register")
        payload = {"username": "carl", "email": "carl@example.com", "password": "123", "phone": "555", "id_number": "9003031234567"}
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="dana", password="SuperSecret123")
        Customer.objects.create(user=self.user, phone="+15551234567", id_number="9004011234567")

    def test_login_returns_tokens(self):
        response = self.client.post(reverse("token_obtain_pair"), {"username": "dana", "password": "SuperSecret123"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_rejects_bad_password(self):
        response = self.client.post(reverse("token_obtain_pair"), {"username": "dana", "password": "wrong"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_auth(self):
        response = self.client.get(reverse("me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh_token(self):
        login = self.client.post(reverse("token_obtain_pair"), {"username": "dana", "password": "SuperSecret123"})
        access, refresh = login.data["access"], login.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        logout = self.client.post(reverse("logout"), {"refresh": refresh})
        self.assertEqual(logout.status_code, status.HTTP_205_RESET_CONTENT)

        refresh_attempt = self.client.post(reverse("token_refresh"), {"refresh": refresh})
        self.assertEqual(refresh_attempt.status_code, status.HTTP_401_UNAUTHORIZED)


class AccountTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="erin", password="SuperSecret123")
        self.customer = Customer.objects.create(user=self.user, phone="+15551234567", id_number="9005011234567")
        self.other_user = User.objects.create_user(username="frank", password="SuperSecret123")
        self.other_customer = Customer.objects.create(user=self.other_user, phone="+15557654321", id_number="9006011234567")
        self.client.force_authenticate(user=self.user)

    def test_create_account(self):
        response = self.client.post(reverse("account-list"), {"account_type": "CHECKING"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data["balance"]), Decimal("0.00"))
        self.assertTrue(response.data["account_number"])

    def test_list_only_returns_own_accounts(self):
        Account.objects.create(customer=self.customer, account_type="CHECKING")
        Account.objects.create(customer=self.other_customer, account_type="SAVINGS")

        response = self.client.get(reverse("account-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)

    def test_cannot_access_another_customers_account(self):
        other_account = Account.objects.create(customer=self.other_customer, account_type="CHECKING")
        response = self.client.post(reverse("account-deposit", args=[other_account.pk]), {"amount": "10.00"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class MoneyMovementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="gina", password="SuperSecret123")
        self.customer = Customer.objects.create(user=self.user, phone="+15551234567", id_number="9007011234567")
        self.account = Account.objects.create(customer=self.customer, account_type="CHECKING", balance=Decimal("100.00"))

        self.other_user = User.objects.create_user(username="hank", password="SuperSecret123")
        self.other_customer = Customer.objects.create(user=self.other_user, phone="+15557654321", id_number="9008011234567")
        self.other_account = Account.objects.create(customer=self.other_customer, account_type="SAVINGS")

        self.client.force_authenticate(user=self.user)

    def test_deposit_increases_balance_and_logs_transaction(self):
        response = self.client.post(reverse("account-deposit", args=[self.account.pk]), {"amount": "50.00"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("150.00"))
        self.assertEqual(Transaction.objects.filter(account=self.account, transaction_type="DEPOSIT").count(), 1)

    def test_deposit_rejects_zero_and_negative_amounts(self):
        for bad_amount in ("0.00", "-10.00"):
            response = self.client.post(reverse("account-deposit", args=[self.account.pk]), {"amount": bad_amount})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_withdraw_decreases_balance(self):
        response = self.client.post(reverse("account-withdraw", args=[self.account.pk]), {"amount": "30.00"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("70.00"))

    def test_withdraw_rejects_insufficient_funds(self):
        response = self.client.post(reverse("account-withdraw", args=[self.account.pk]), {"amount": "9999.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("100.00"))

    def test_transfer_moves_money_between_accounts(self):
        response = self.client.post(
            reverse("account-transfer", args=[self.account.pk]),
            {"to_account_number": self.other_account.account_number, "amount": "40.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.account.refresh_from_db()
        self.other_account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("60.00"))
        self.assertEqual(self.other_account.balance, Decimal("40.00"))

        self.assertEqual(
            Transaction.objects.filter(account=self.account, transaction_type="TRANSFER_OUT").count(), 1
        )
        self.assertEqual(
            Transaction.objects.filter(account=self.other_account, transaction_type="TRANSFER_IN").count(), 1
        )

    def test_transfer_rejects_unknown_destination(self):
        response = self.client.post(
            reverse("account-transfer", args=[self.account.pk]),
            {"to_account_number": "0000000000", "amount": "10.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_transfer_rejects_same_account(self):
        response = self.client.post(
            reverse("account-transfer", args=[self.account.pk]),
            {"to_account_number": self.account.account_number, "amount": "10.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transfer_rejects_insufficient_funds(self):
        response = self.client.post(
            reverse("account-transfer", args=[self.account.pk]),
            {"to_account_number": self.other_account.account_number, "amount": "9999.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_per_account_transaction_history(self):
        self.client.post(reverse("account-deposit", args=[self.account.pk]), {"amount": "10.00"})
        self.client.post(reverse("account-withdraw", args=[self.account.pk]), {"amount": "5.00"})

        response = self.client.get(reverse("account-transactions", args=[self.account.pk]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 2)

    def test_combined_transaction_history_across_accounts(self):
        second_account = Account.objects.create(customer=self.customer, account_type="SAVINGS")
        self.client.post(reverse("account-deposit", args=[self.account.pk]), {"amount": "10.00"})
        self.client.post(reverse("account-deposit", args=[second_account.pk]), {"amount": "20.00"})

        response = self.client.get(reverse("transaction-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 2)
