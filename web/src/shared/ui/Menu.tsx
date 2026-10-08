'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/shared/lib';

const CloseContext = createContext<() => void>(() => {});

/** Ferme le menu qui contient l'appelant (contenu sur mesure : recherche, choix…). */
export const useCloseMenu = () => useContext(CloseContext);

/**
 * Menu déroulant (compte, « … » d'un post) : se ferme au clic extérieur, avec Échap
 * ou après un choix. Le contenu n'est rendu qu'à l'ouverture.
 */
export function Menu({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-controls': string }) => React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ onClick: () => setOpen(!open), 'aria-expanded': open, 'aria-controls': id })}
      {open ? (
        <CloseContext.Provider value={() => setOpen(false)}>
          <div
            id={id}
            role="menu"
            className={cn(
              'animate-pop absolute top-full z-40 mt-1.5 min-w-56 rounded-xl border border-line bg-card p-1 shadow-raised',
              align === 'end' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {children}
          </div>
        </CloseContext.Provider>
      ) : null}
    </div>
  );
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body-sm text-ink transition-colors outline-none hover:bg-container focus-visible:bg-container [&_svg]:size-4 [&_svg]:text-ink-muted';

export function MenuItem({
  href,
  onSelect,
  children,
  danger,
}: {
  href?: string;
  onSelect?: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const close = useContext(CloseContext);
  const classes = cn(ITEM, danger && 'text-danger [&_svg]:text-danger');
  if (href) {
    return (
      <Link href={href} role="menuitem" className={classes} onClick={close}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      className={classes}
      onClick={() => {
        close();
        onSelect?.();
      }}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-label-md font-medium text-ink-faint">{children}</div>;
}
