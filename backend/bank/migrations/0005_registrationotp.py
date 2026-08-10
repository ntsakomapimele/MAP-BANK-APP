from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bank", "0004_customer_id_number"),
    ]

    operations = [
        migrations.CreateModel(
            name="RegistrationOtp",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField()),
                ("otp", models.CharField(max_length=6)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("expires_at", models.DateTimeField()),
                ("used", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
