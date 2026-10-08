'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/shared/lib';

/** Fenêtre modale native (<dialog>) : focus, Échap et arrière-plan gérés par le navigateur. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'animate-pop m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-raised backdrop:bg-black/40 backdrop:backdrop-blur-[3px]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 className="text-headline-md">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-container hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-5 pb-5">{open ? children : null}</div>
    </dialog>
  );
}
