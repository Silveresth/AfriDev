from django.conf import settings
from django.core.management.base import BaseCommand

from features.knowledge.services import reembed_all


class Command(BaseCommand):
    help = (
        "Recalcule les embeddings de toute la base de connaissances (à lancer après avoir "
        "ajouté VOYAGE_API_KEY ou changé VOYAGE_MODEL)."
    )

    def handle(self, *args, **options):
        model = settings.VOYAGE_MODEL if settings.VOYAGE_API_KEY else "embedding local"
        self.stdout.write(f"Modèle : {model}")
        done = chunks = 0
        for progress in reembed_all():
            done, chunks = progress
            if done % 100 == 0:
                self.stdout.write(f"{done} document(s)…")
        summary = f"{done} document(s), {chunks} morceau(x) réindexé(s)."
        self.stdout.write(self.style.SUCCESS(summary))
