import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { type Schemas, uploadFromUri } from '@/shared/api';
import { t } from '@/shared/i18n';

export type MediaAsset = Schemas['MediaOutput'];

const MAX_IMAGE_SIDE = 1600;

/** Choix dans la galerie, sans envoi (l'écran affiche un aperçu pendant l'envoi). */
export async function pickFromLibrary(kinds: ('images' | 'videos')[] = ['images', 'videos']) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && !permission.accessPrivileges) throw new Error(t('media.permission'));
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kinds, quality: 1, videoMaxDuration: 60 });
  return picked.canceled ? null : (picked.assets[0] ?? null);
}

/**
 * Envoie une photo ou une vidéo de la galerie vers le stockage objet. La photo est réduite
 * (1600 px) et recompressée sur le téléphone avant l'envoi, pour économiser le forfait.
 */
export async function uploadPicked(asset: ImagePicker.ImagePickerAsset): Promise<MediaAsset> {
  if (asset.type === 'video') {
    return uploadFromUri(asset.uri, 'video', asset.mimeType ?? 'video/mp4', asset.fileName ?? 'video.mp4');
  }
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_IMAGE_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE });
  }
  const image = await (await context.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return uploadFromUri(image.uri, 'image', 'image/jpeg', 'photo.jpg');
}

/** Photo ou vidéo de la galerie, envoyée ; null si le choix est annulé. */
export async function pickAndUploadMedia(): Promise<MediaAsset | null> {
  const asset = await pickFromLibrary();
  return asset ? uploadPicked(asset) : null;
}
