'use client';

import { useIsClient } from '@/shared/hooks';
import { timeAgo } from '@/shared/lib';

/** « il y a 2 h » ; la date exacte au survol. Calculée côté client (fuseau de l'utilisateur). */
export function TimeAgo({ date, className }: { date: string; className?: string }) {
  const isClient = useIsClient();
  const exact = new Date(date);
  return (
    <time dateTime={date} title={exact.toLocaleString('fr')} className={className}>
      {isClient ? timeAgo(date) : exact.toLocaleDateString('fr', { timeZone: 'UTC' })}
    </time>
  );
}
