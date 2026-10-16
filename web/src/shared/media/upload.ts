'use client';

import type { Schemas } from '@afridev/api-client';

import { uploadDirect } from '@/shared/api';
import { API_URL } from '@/shared/api/config';

export type MediaAsset = Schemas['MediaOutput'];
export type MediaKind = 'image' | 'video' | 'audio';

const MAX_IMAGE_SIDE = 1600;
const VIDEO_MAX_MB = 50;

/** En dev, l'API sert les fichiers en chemins relatifs (/media/…) ; en production, le CDN R2. */
export function absoluteMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

/**
 * Recompresse une photo dans le navigateur avant l'envoi (WebP, `maxSide` px max) :
 * une photo de téléphone de 4 Mo passe souvent sous 300 Ko.
 */
export async function compressImage(file: File, maxSide = MAX_IMAGE_SIDE): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
  } catch {
    return file; // format non décodable par le navigateur : envoyé tel quel
  }
}

export async function uploadMedia(file: File, kind: MediaKind, options: { maxSide?: number } = {}): Promise<MediaAsset> {
  if (kind === 'video' && file.size > VIDEO_MAX_MB * 1024 * 1024) {
    throw new Error(`Vidéo trop lourde (${VIDEO_MAX_MB} Mo maximum). Compressez-la avant l'envoi.`);
  }
  const prepared = kind === 'image' ? await compressImage(file, options.maxSide) : file;
  // Envoi direct vers le stockage objet (URL pré-signée) : le fichier ne passe pas par l'API.
  return uploadDirect({
    kind,
    body: prepared,
    mimeType: prepared.type || 'application/octet-stream',
    size: prepared.size,
    filename: prepared.name,
  });
}

/**
 * Photo de profil ou bannière : recompressée à la bonne taille dans le navigateur, puis envoyée
 * directement vers R2. Renvoie l'URL publique de l'original (déjà léger), utilisable aussitôt.
 */
export async function uploadProfileImage(file: File, target: 'avatar' | 'banner'): Promise<string> {
  const asset = await uploadMedia(file, 'image', { maxSide: target === 'avatar' ? 512 : 1600 });
  const url = absoluteMediaUrl(asset.original_url);
  if (!url) throw new Error("L'image n'a pas pu être enregistrée.");
  return url;
}
