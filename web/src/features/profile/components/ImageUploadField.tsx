'use client';

import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { absoluteMediaUrl, uploadProfileImage } from '@/shared/media';
import { Avatar } from '@/shared/ui';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Envoi direct vers Cloudflare R2 avec aperçu immédiat : l'image locale s'affiche dès le choix,
 * pendant que sa version recompressée part vers le stockage objet (rien ne transite par l'API).
 */
function useImageUpload(target: 'avatar' | 'banner', onUploaded: (url: string) => void) {
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

/** Bannière (ratio 3:1) avec avatar superposé, chacun modifiable par un clic. */
export function ProfileImagesField({
  name,
  accent,
  avatarUrl,
  bannerUrl,
  onChange,
  onBusyChange,
}: {
  name: string;
  accent: string;
  avatarUrl: string;
  bannerUrl: string;
  onChange: (changes: { avatar_url?: string; banner_url?: string }) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const bannerInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const banner = useImageUpload('banner', (url) => onChange({ banner_url: url }));
  const avatar = useImageUpload('avatar', (url) => onChange({ avatar_url: url }));
  const busy = banner.uploading || avatar.uploading;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const bannerSrc = banner.preview ?? absoluteMediaUrl(bannerUrl);
  const avatarSrc = avatar.preview ?? absoluteMediaUrl(avatarUrl);

  return (
    <div className="space-y-2">
      <div className="relative pb-10">
        <button
          type="button"
          onClick={() => bannerInput.current?.click()}
          className="group relative block aspect-[3/1] w-full overflow-hidden rounded-xl ring-1 ring-line"
          style={{ backgroundColor: accent }}
          aria-label="Changer la bannière"
        >
          {bannerSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou CDN
            <img src={bannerSrc} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}
          <span className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/10" aria-hidden />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center gap-2 text-body-sm font-semibold text-white transition-opacity',
              banner.uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            {banner.uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
            {banner.uploading ? 'Envoi…' : 'Changer la bannière'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          className="group absolute bottom-0 left-4 rounded-full"
          aria-label="Changer la photo de profil"
        >
          <Avatar name={name} src={avatarSrc} color={accent} size={84} className="text-[1.75rem] ring-4 ring-card" />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity',
              avatar.uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            {avatar.uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          </span>
        </button>
        {bannerUrl && !banner.uploading ? (
          <button
            type="button"
            onClick={() => {
              banner.reset();
              onChange({ banner_url: '' });
            }}
            className="absolute right-0 bottom-1 flex items-center gap-1 text-label-md text-ink-muted hover:text-danger"
          >
            <Trash2 className="size-3.5" aria-hidden /> Retirer la bannière
          </button>
        ) : null}
      </div>
      <p className="text-label-md text-ink-faint">JPEG, PNG ou WebP · recompressées automatiquement avant l&apos;envoi (avatar 512 px, bannière 1600 px).</p>
      {banner.error || avatar.error ? <p className="text-body-sm text-danger">{banner.error ?? avatar.error}</p> : null}
      <input ref={bannerInput} type="file" accept={ACCEPT} hidden onChange={(e) => void banner.pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <input ref={avatarInput} type="file" accept={ACCEPT} hidden onChange={(e) => void avatar.pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
    </div>
  );
}
