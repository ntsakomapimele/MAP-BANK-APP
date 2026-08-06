from django.contrib import admin
from .models import Customer, Account, Transaction


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "phone", "created_at")
    search_fields = ("user__username", "user__email", "phone")


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "account_number",
        "customer",
        "account_type",
        "balance",
        "created_at",
    )
    list_filter = ("account_type",)
    search_fields = ("account_number", "customer__user__username")
    readonly_fields = ("account_number", "balance", "created_at")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "account",
        "transaction_type",
        "amount",
        "balance_after",
        "related_account",
        "created_at",
    )
    list_filter = ("transaction_type", "created_at")
    search_fields = ("account__account_number", "related_account__account_number")
    readonly_fields = [f.name for f in Transaction._meta.fields]

    def has_add_permission(self, request):
        # Transactions are only ever created by the API through the money-movement
        # actions (deposit/withdraw/transfer), never hand-entered in admin.
        return False

    def has_change_permission(self, request, obj=None):
        return False
