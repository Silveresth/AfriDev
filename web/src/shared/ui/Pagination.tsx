'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/shared/lib';

/** « ‹ Précédent · Page 3 · Suivant › » sous un tableau paginé. */
export function Pagination({
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  loading = false,
  className,
}: {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  loading?: boolean;
  className?: string;
}) {
  if (!hasPrevious && !hasNext) return null;
  // Nouvelle page : on la lit depuis le haut, pas depuis le bas de la précédente.
  const go = (move: () => void) => () => {
    move();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const button =
    'inline-flex h-9 items-center gap-1 rounded-full border border-line bg-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-container disabled:pointer-events-none disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className={cn('mt-4 flex items-center justify-between gap-3', className)}>
      <button type="button" onClick={go(onPrevious)} disabled={!hasPrevious || loading} className={button}>
        <ChevronLeft className="size-4" aria-hidden /> Précédent
      </button>
      <span className="text-body-sm text-ink-muted" aria-live="polite">
        Page <span className="font-semibold text-ink tabular-nums">{page}</span>
      </span>
      <button type="button" onClick={go(onNext)} disabled={!hasNext || loading} className={button}>
        Suivant <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
