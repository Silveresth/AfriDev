from django.conf import settings
from django.db import models

from core.models import BaseModel


class SyncRejection(BaseModel):
    """Écriture hors ligne refusée définitivement (droits, validation, secret détecté…).

    Elle est retirée de la file de l'appareil pour ne pas bloquer les suivantes ;
    le client l'affiche à l'utilisateur via GET /api/sync/rejections/.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sync_rejections"
    )
    op_id = models.BigIntegerField(null=True, blank=True)
    table = models.CharField(max_length=40)
    record_id = models.CharField(max_length=64)
    op = models.CharField(max_length=10)
    data = models.JSONField(default=dict, blank=True)
    code = models.CharField(max_length=40)
    message = models.CharField(max_length=300)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
