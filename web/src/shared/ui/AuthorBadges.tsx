import { MapPin } from 'lucide-react';

import { cn } from '@/shared/lib';

/** Pays d'une localisation libre (« Dakar, Sénégal » → « Sénégal »). */
export function countryOf(location?: string | null) {
  const parts = (location ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? '';
}

/**
 * Badges Pays / Spécialité à côté du nom de l'auteur (cartes de posts, questions, snippets).
 * Rien n'est affiché si le profil ne les renseigne pas.
 */
export function AuthorBadges({
  location,
  stack,
  className,
}: {
  location?: string | null;
  stack?: string[] | null;
  className?: string;
}) {
  const country = countryOf(location);
  const specialty = Array.isArray(stack) && stack.length > 0 ? stack[0] : undefined;
  if (!country && !specialty) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      {country ? (
        <span
          title={location ?? undefined}
          className="inline-flex h-5 max-w-32 items-center gap-0.5 truncate rounded-md border border-line bg-container-low px-1.5 text-[0.6875rem] font-medium text-ink-muted"
        >
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{country}</span>
        </span>
      ) : null}
      {specialty ? (
        <span className="inline-flex h-5 max-w-28 items-center truncate rounded-md border border-primary/20 bg-primary-soft px-1.5 text-[0.6875rem] font-medium text-primary-ink">
          <span className="truncate">{specialty}</span>
        </span>
      ) : null}
    </span>
  );
}
