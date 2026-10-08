'use client';

import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/shared/lib';

import { useDataSaver } from './DataSaverProvider';

/** Bascule rapide « Texte brut », toujours visible dans l'en-tête. */
export function DataSaverToggle({ className }: { className?: string }) {
  const { textOnly, setMode } = useDataSaver();
  return (
    <button
      type="button"
      onClick={() => setMode(textOnly ? 'off' : 'on')}
      aria-pressed={textOnly}
      title={textOnly ? 'Réafficher les médias' : 'Masquer images et vidéos'}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded border px-2.5 text-body-sm transition-colors',
        textOnly
          ? 'border-secondary bg-secondary-soft text-on-secondary-soft'
          : 'border-line text-ink-muted hover:bg-container',
        className,
      )}
    >
      {textOnly ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      <span className="hidden sm:inline">Texte brut</span>
    </button>
  );
}
