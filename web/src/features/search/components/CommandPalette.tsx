'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { OPEN_COMMAND_EVENT } from '@/shared/layout';

const Palette = dynamic(() => import('./Palette'), { ssr: false });

/**
 * Palette de recherche instantanée (⌘K / Ctrl+K, ou « / ») : navigation, création de contenu
 * et résultats de la base de connaissances pendant la frappe, entièrement au clavier.
 * Seuls les raccourcis sont dans le JavaScript initial ; la palette se charge à la première ouverture.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, []);

  return open ? <Palette onClose={() => setOpen(false)} /> : null;
}
