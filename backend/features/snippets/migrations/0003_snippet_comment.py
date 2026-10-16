import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ("snippets", "0002_snippet_hub_id"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Ajouter comment_count à Snippet
        migrations.AddField(
            model_name="snippet",
            name="comment_count",
            field=models.PositiveIntegerField(default=0),
        ),
        # 2. Créer le modèle SnippetComment
        migrations.CreateModel(
            name="SnippetComment",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(default=timezone.now, editable=False),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "deleted_at",
                    models.DateTimeField(blank=True, db_index=True, null=True),
                ),
                ("body", models.TextField(max_length=2000)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="snippet_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="replies",
                        to="snippets.snippetcomment",
                    ),
                ),
                (
                    "snippet",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="snippets.snippet",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
    ]
