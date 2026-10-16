from django.core.management.base import BaseCommand

from features.profiles.tasks import recompute_all_karma


class Command(BaseCommand):
    help = "Recalcule le Craft Score (Entraide, Création) et les badges de tous les membres."

    def handle(self, *args, **options):
        # Deux passes : les badges « Top 5 % » lisent les jauges Entraide de tous les membres.
        recompute_all_karma()
        total = recompute_all_karma()
        self.stdout.write(self.style.SUCCESS(f"Craft Score recalculé pour {total} membres."))
