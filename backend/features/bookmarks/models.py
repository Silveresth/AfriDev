from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import BaseModel

TARGET_FIELDS = ("post_id", "snippet_id", "question_id", "project_id")


def _exactly_one(fields) -> Q:
    condition = Q()
    for chosen in fields:
        condition |= Q(**{f"{f}__isnull": f != chosen for f in fields})
    return condition


class BookmarkCollection(BaseModel):
    """Dossier de marque-pages (« Mes snippets Django », « Trucs & astuces SQL »)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmark_collections"
    )
    name = models.CharField(max_length=60)
    description = models.CharField(max_length=300, blank=True)
    is_private = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["owner", "-created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"],
                condition=Q(deleted_at__isnull=True),
                name="bookmarks_collection_unique_name",
            )
        ]

    def __str__(self):
        return self.name


class BookmarkItem(BaseModel):
    """Contenu enregistré : exactement un de post_id, snippet_id, question_id, project_id.

    Références sans clé étrangère (features feed / snippets / qa) : un contenu supprimé
    laisse l'élément en place, affiché comme indisponible.
    """

    collection = models.ForeignKey(
        BookmarkCollection, on_delete=models.CASCADE, related_name="items"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmark_items"
    )
    post_id = models.UUIDField(null=True, blank=True, db_index=True)
    snippet_id = models.UUIDField(null=True, blank=True, db_index=True)
    question_id = models.UUIDField(null=True, blank=True, db_index=True)
    project_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=_exactly_one(TARGET_FIELDS),
                name="bookmarks_item_one_target_v2",
            ),
            *[
                models.UniqueConstraint(
                    fields=["collection", field],
                    condition=Q(**{f"{field}__isnull": False}),
                    name=f"bookmarks_item_unique_{field}",
                )
                for field in TARGET_FIELDS
            ],
        ]

    @property
    def target_type(self) -> str:
        return next(field[:-3] for field in TARGET_FIELDS if getattr(self, field))

    @property
    def target_id(self):
        return next(getattr(self, field) for field in TARGET_FIELDS if getattr(self, field))
