"""Lectures. Seul point d'entrée en lecture pour les autres features."""

from integrations import storage

from .models import MediaAsset


def get_asset(*, asset_id) -> MediaAsset | None:
    return MediaAsset.objects.alive().filter(id=asset_id).first()


def get_owned_asset(*, asset_id, owner_id, kind: str | None = None) -> MediaAsset | None:
    """Vérifie qu'un média joint à un post ou une question appartient bien à l'auteur."""
    assets = MediaAsset.objects.alive().filter(id=asset_id, owner_id=owner_id)
    if kind:
        assets = assets.filter(kind=kind)
    return assets.first()


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
    return storage.read(asset.original_path), asset.original_path.rsplit("/", 1)[-1]
