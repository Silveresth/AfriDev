"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from integrations import cloudinary, storage

from .models import MediaAsset


def get_asset(*, asset_id) -> MediaAsset | None:
    return MediaAsset.objects.alive().filter(id=asset_id).first()


def get_owned_asset(
    *, asset_id, owner_id, kind: str | None = None, include_uploading: bool = False
) -> MediaAsset | None:
    """Vérifie qu'un média joint à un post ou une question appartient bien à l'auteur.

    Un média dont l'envoi n'est pas confirmé ne peut pas être joint à un contenu.
    """
    assets = MediaAsset.objects.alive().filter(id=asset_id, owner_id=owner_id)
    if not include_uploading:
        assets = assets.exclude(status=MediaAsset.Status.UPLOADING)
    if kind:
        assets = assets.filter(kind=kind)
    return assets.first()


def ready_asset_ids(*, kind: str, owner_id=None):
    """Sous-requête des médias prêts d'un type (filtre « vidéos » d'un fil, sans jointure)."""
    assets = MediaAsset.objects.alive().filter(kind=kind, status=MediaAsset.Status.READY)
    if owner_id:
        assets = assets.filter(owner_id=owner_id)
    return assets.values("id")


def describe(asset: MediaAsset) -> dict:
    """Forme publique : le client choisit la variante selon le réseau (mode « Texte seul »)."""
    urls = {name: storage.public_url(path) for name, path in asset.variants.items()}
    return {
        "id": str(asset.id),
        "kind": asset.kind,
        "status": asset.status,
        "width": asset.width,
        "height": asset.height,
        "duration_seconds": asset.duration_seconds,
        "thumbhash": asset.thumbhash,
        "original_url": storage.public_url(asset.original_path),
        "urls": urls,
    }


def describe_many(*, asset_ids) -> dict:
    ids = [asset_id for asset_id in asset_ids if asset_id]
    if not ids:
        return {}
    return {asset.id: describe(asset) for asset in MediaAsset.objects.alive().filter(id__in=ids)}


def read_original(*, asset_id) -> tuple[bytes, str] | None:
    """(contenu, nom de fichier) de l'original, pour la transcription vocale."""
    asset = get_asset(asset_id=asset_id)
    if asset is None:
        return None
    name = asset.original_path.rsplit("/", 1)[-1]
    if asset.original_path.startswith(("http://", "https://")):  # fichier sur Cloudinary
        try:
            return cloudinary.download(asset.original_path, max_bytes=asset.size_bytes + 1024), name
        except cloudinary.CloudinaryError:
            return None
    return storage.read(asset.original_path), name
