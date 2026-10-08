from django.db import models
from pgvector.django import VectorField

from core.models import BaseModel
from integrations.embeddings import EMBEDDING_DIM


class Document(BaseModel):
    """Contenu de référence indexé pour le RAG (snippet public, question résolue, projet)."""

    class SourceType(models.TextChoices):
        SNIPPET = "snippet", "Snippet"
        QUESTION = "question", "Question résolue"
        PROJECT = "project", "Projet"

    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    source_id = models.UUIDField()
    title = models.CharField(max_length=200)
    url = models.CharField(max_length=300, blank=True)
    content = models.TextField()
    content_hash = models.CharField(max_length=64)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source_type", "source_id"], name="knowledge_doc_unique"
            )
        ]

    def __str__(self):
        return f"{self.source_type}:{self.title}"


class Chunk(BaseModel):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    position = models.PositiveIntegerField()
    text = models.TextField()
    embedding = VectorField(dimensions=EMBEDDING_DIM)

    class Meta:
        ordering = ["document", "position"]
        # Index HNSW (distance cosinus) créé par une migration réservée à PostgreSQL.
