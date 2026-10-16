import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { absoluteUrl, uploadFromUri } from '@/shared/api';

const MAX_SIDE = { avatar: 512, banner: 1600 } as const;
const ASPECT = { avatar: [1, 1], banner: [3, 1] } as const;

export class PhotoAccessDenied extends Error {}

/**
 * Choisit une photo dans la galerie (recadrage natif), la réduit et la recompresse sur le
 * téléphone, puis l'envoie directement vers le stockage objet (URL pré-signée R2).
 * Renvoie { preview: URI locale à afficher tout de suite, upload: promesse de l'URL publique },
 * ou null si l'utilisateur annule.
 */
export async function pickProfileImage(target: 'avatar' | 'banner'): Promise<{ preview: string; upload: Promise<string> } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && !permission.accessPrivileges) throw new PhotoAccessDenied();

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [...ASPECT[target]],
    quality: 1,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;

  const upload = (async () => {
    const context = ImageManipulator.manipulate(asset.uri);
    const max = MAX_SIDE[target];
    if (Math.max(asset.width, asset.height) > max) {
      context.resize(asset.width >= asset.height ? { width: max } : { height: max });
    }
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    const media = await uploadFromUri(result.uri, 'image', 'image/jpeg', `${target}.jpg`);
    const url = absoluteUrl(media.original_url);
    if (!url) throw new Error('Image non enregistrée.');
    return url;
  })();
  return { preview: asset.uri, upload };
}
