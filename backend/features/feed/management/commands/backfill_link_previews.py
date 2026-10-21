from django.core.management.base import BaseCommand

from features.feed import services
from features.feed.models import Post


class Command(BaseCommand):
    help = "Prépare la carte (et le résumé IA) des liens des posts publiés avant cette fonction."

    def handle(self, *args, **options):
        urls = set(Post.objects.alive().exclude(link_url="").values_list("link_url", flat=True))
        for url in urls:
            services.request_link_preview(url=url)
        self.stdout.write(f"{len(urls)} lien(s) mis en file.")
