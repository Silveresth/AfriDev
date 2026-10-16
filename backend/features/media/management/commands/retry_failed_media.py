from django.core.management.base import BaseCommand

from features.media.models import MediaAsset
from features.media.tasks import transcode_media


class Command(BaseCommand):
    help = "Relance le transcodage des médias en échec (images par défaut)."

    def add_arguments(self, parser):
        parser.add_argument("--kind", default="image", choices=["image", "video", "audio"])

    def handle(self, *args, **options):
        ids = list(
            MediaAsset.objects.alive()
            .filter(status=MediaAsset.Status.FAILED, kind=options["kind"])
            .values_list("id", flat=True)
        )
        for asset_id in ids:
            transcode_media(str(asset_id))
        ready = MediaAsset.objects.filter(id__in=ids, status=MediaAsset.Status.READY).count()
        self.stdout.write(self.style.SUCCESS(f"{ready}/{len(ids)} média(s) réparé(s)."))
