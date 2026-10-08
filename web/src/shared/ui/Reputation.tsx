import { Award, Sparkles } from 'lucide-react';

import { cn, formatCount } from '@/shared/lib';

/** Karma compact (« ✦ 1,2 k »), avec le barème au survol. */
export function KarmaPill({ karma, className }: { karma: number; className?: string }) {
  return (
    <span
      title={`${karma} points de karma (+5 par vote ↑, +15 par réponse acceptée, +10 par snippet enregistré)`}
      className={cn('inline-flex shrink-0 items-center gap-0.5 font-medium text-tertiary tabular-nums', className)}
    >
      <Sparkles className="size-3" aria-hidden />
      {formatCount(karma)}
      <span className="sr-only">points de karma</span>
    </span>
  );
}

/** Badge tech (« Expert Python », « Top 5 % Entraide »). */
export function TechBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-36 shrink-0 items-center gap-1 truncate rounded-md border border-tertiary/25 bg-tertiary-soft px-1.5 text-[0.6875rem] font-medium text-on-tertiary-soft',
        className,
      )}
    >
      <Award className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Ligne de réputation sous le nom d'un auteur : karma et premier badge. */
export function Reputation({
  karma,
  badges,
  className,
}: {
  karma?: number | null;
  badges?: Array<{ code: string; label: string }> | null;
  className?: string;
}) {
  const badge = badges?.[0];
  if (!karma && !badge) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      {karma ? <KarmaPill karma={karma} /> : null}
      {badge ? <TechBadge label={badge.label} /> : null}
    </span>
  );
}
