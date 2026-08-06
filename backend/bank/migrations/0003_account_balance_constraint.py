# Generated manually to accompany the Account.Meta change (ordering + balance >= 0 constraint)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bank", "0002_transaction"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="account",
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="account",
            constraint=models.CheckConstraint(
                check=models.Q(("balance__gte", 0)), name="account_balance_non_negative"
            ),
        ),
    ]
