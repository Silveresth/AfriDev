'use client';

import type { Schemas } from '@afridev/api-client';

import { apiFetch } from '@/shared/api';

export type MediaAsset = Schemas['MediaOutput'];
export type MediaKind = 'image' | 'video' | 'audio';

const MAX_IMAGE_SIDE = 1600;
const VIDEO_MAX_MB = 50;

/**
 * Recompresse une photo dans le navigateur avant l'envoi (WebP, 1600 px max) :
 * une photo de téléphone de 4 Mo passe souvent sous 300 Ko.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
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

export async function uploadMedia(file: File, kind: MediaKind): Promise<MediaAsset> {
  if (kind === 'video' && file.size > VIDEO_MAX_MB * 1024 * 1024) {
    throw new Error(`Vidéo trop lourde (${VIDEO_MAX_MB} Mo maximum). Compressez-la avant l'envoi.`);
  }
  const prepared = kind === 'image' ? await compressImage(file) : file;
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', prepared);
  const response = await apiFetch('/api/media/', { method: 'POST', body: form });
  return (await response.json()) as MediaAsset;
}
