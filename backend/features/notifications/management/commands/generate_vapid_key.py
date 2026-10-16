from django.core.management.base import BaseCommand

from integrations import push


class Command(BaseCommand):
    help = "Génère la clé VAPID des notifications push du site (à mettre dans le .env une fois)."

    def handle(self, *args, **options):
        self.stdout.write(f"WEBPUSH_VAPID_PRIVATE_KEY={push.generate_private_key()}")
        self.stdout.write(
            self.style.WARNING(
                "Gardez-la secrète et stable : la changer désabonne tous les navigateurs."
            )
        )
