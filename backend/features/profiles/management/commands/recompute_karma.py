from django.core.management.base import BaseCommand

from features.profiles.tasks import recompute_all_karma


class Command(BaseCommand):
    help = "Recalcule le karma et les badges de tous les membres."

    def handle(self, *args, **options):
        total = recompute_all_karma()
        self.stdout.write(self.style.SUCCESS(f"Réputation recalculée pour {total} membres."))
