'use client';

import { useState } from 'react';

import { cn, initials } from '@/shared/lib';

const PALETTE = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-[#7c3aed]', 'bg-[#0e7490]', 'bg-[#2563eb]'];

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Initiales sur fond coloré (0 octet réseau) ; la photo, si elle existe, se superpose,
 * disparaît en mode « Texte seul » (data-media) et en cas d'échec de chargement (hors ligne).
 */
export function Avatar({
  name,
  src,
  size = 40,
  color,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  /** Couleur du fond des initiales (accent du profil) ; sinon déduite du nom. */
  color?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        colorFor(name),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38), backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars externes (GitHub), déjà légers
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          data-media
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
