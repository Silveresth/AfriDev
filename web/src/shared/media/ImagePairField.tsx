'use client';

import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';

import { absoluteMediaUrl, uploadProfileImage } from './upload';

const ACCEPT = 'image/jpeg,image/png,image/webp';

function useUpload(target: 'avatar' | 'banner', onUploaded: (url: string) => void) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      onUploaded(await uploadProfileImage(file, target));
    } catch (err) {
      setPreview(null);
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }
  return { preview, uploading, error, pick, reset: () => setPreview(null) };
}

/**
 * Bannière (3:1) et image de profil superposée, chacune choisie d'un clic et envoyée tout de suite
 * vers le stockage objet. Sert aux hubs et aux projets (`square` : logo à coins arrondis).
 */
export function ImagePairField({
  name,
  bannerUrl,
  imageUrl,
  onChange,
  onBusyChange,
  square = false,
  imageLabel = 'Photo de profil',
}: {
  name: string;
  bannerUrl: string;
  imageUrl: string;
  onChange: (changes: { banner?: string; image?: string }) => void;
  onBusyChange?: (busy: boolean) => void;
  square?: boolean;
  imageLabel?: string;
}) {
  const bannerInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const banner = useUpload('banner', (url) => onChange({ banner: url }));
  const image = useUpload('avatar', (url) => onChange({ image: url }));
  const busy = banner.uploading || image.uploading;
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  const bannerSrc = banner.preview ?? absoluteMediaUrl(bannerUrl);
  const imageSrc = image.preview ?? absoluteMediaUrl(imageUrl);
  const shape = square ? 'rounded-2xl' : 'rounded-full';

  return (
    <div className="space-y-2">
      <div className="relative pb-10">
        <button
          type="button"
          onClick={() => bannerInput.current?.click()}
          className="group relative block aspect-[3/1] w-full overflow-hidden rounded-xl bg-container ring-1 ring-line"
          aria-label="Choisir la bannière"
        >
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou CDN
            <img src={bannerSrc} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center gap-2 text-body-sm font-medium text-ink-muted">
              <ImagePlus className="size-5" aria-hidden /> Ajouter une bannière
            </span>
          )}
          {bannerSrc ? (
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-body-sm font-semibold text-white transition-opacity',
                banner.uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
              )}
            >
              {banner.uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
              {banner.uploading ? 'Envoi…' : 'Changer la bannière'}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          className={cn('group absolute bottom-0 left-4 size-20 overflow-hidden bg-container-high ring-4 ring-card', shape)}
          aria-label={`Choisir : ${imageLabel}`}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou CDN
            <img src={imageSrc} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-[1.5rem] font-bold text-ink-muted">{(name.trim()[0] ?? '?').toUpperCase()}</span>
          )}
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity',
              image.uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            {image.uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          </span>
        </button>
        <span className="absolute right-0 bottom-1 flex gap-3">
          {imageUrl && !image.uploading ? (
            <button
              type="button"
              onClick={() => {
                image.reset();
                onChange({ image: '' });
              }}
              className="flex items-center gap-1 text-label-md text-ink-muted hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden /> Retirer l’image
            </button>
          ) : null}
          {bannerUrl && !banner.uploading ? (
            <button
              type="button"
              onClick={() => {
                banner.reset();
                onChange({ banner: '' });
              }}
              className="flex items-center gap-1 text-label-md text-ink-muted hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden /> Retirer la bannière
            </button>
          ) : null}
        </span>
      </div>
      <p className="text-label-md text-ink-faint">JPEG, PNG ou WebP · recompressées avant l&apos;envoi.</p>
      {banner.error || image.error ? <p className="text-body-sm text-danger">{banner.error ?? image.error}</p> : null}
      <input ref={bannerInput} type="file" accept={ACCEPT} hidden onChange={(e) => void banner.pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <input ref={imageInput} type="file" accept={ACCEPT} hidden onChange={(e) => void image.pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
    </div>
  );
}
