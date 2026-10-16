from datetime import timedelta

from django.core.management.base import BaseCommand

from features.media.services import purge_stale_uploads


class Command(BaseCommand):
    help = "Supprime les envois pré-signés jamais confirmés (à lancer chaque jour par cron)."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=24)

    def handle(self, *args, **options):
        total = purge_stale_uploads(older_than=timedelta(hours=options["hours"]))
        self.stdout.write(self.style.SUCCESS(f"{total} envoi(s) abandonné(s) supprimé(s)."))
