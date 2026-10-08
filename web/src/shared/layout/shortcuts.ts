'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NAV_ITEMS } from './nav';

/** Vrai quand la frappe vise un champ (les raccourcis à une touche ne doivent pas s'y déclencher). */
export function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

const COLLAPSED_KEY = 'afridev:sidebar-collapsed';

/** Colonne de gauche repliée en rail d'icônes (mémorisé sur cet appareil, raccourci « [ »). */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Lecture après l'hydratation : le rendu serveur reste toujours déplié.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      /* stockage indisponible : colonne dépliée */
    }
  }, []);

  const toggle = () =>
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1');
      } catch {
        /* préférence non mémorisée */
      }
      return !current;
    });

  return [collapsed, toggle] as const;
}

/**
 * Raccourcis globaux du cadre : « G » puis une touche pour changer de rubrique (G H accueil,
 * G Q questions…), « [ » pour replier la colonne, « ? » pour afficher l'aide.
 */
export function useShellShortcuts({ onToggleSidebar, onHelp }: { onToggleSidebar: () => void; onHelp: () => void }) {
  const router = useRouter();

  useEffect(() => {
    let leader = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (leader && Date.now() - leader < 1200) {
        leader = 0;
        const item = NAV_ITEMS.find((candidate) => candidate.key === key);
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (key === 'g') {
        leader = Date.now();
      } else if (event.key === '[') {
        event.preventDefault();
        onToggleSidebar();
      } else if (event.key === '?') {
        event.preventDefault();
        onHelp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, onToggleSidebar, onHelp]);
}
