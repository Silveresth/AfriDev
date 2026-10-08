'use client';

import { useEffect } from 'react';
import { useServerInsertedHTML } from 'next/navigation';

import { useLocalPreference } from '@/shared/hooks';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_KEY = 'afridev.theme';
export const TEXT_ONLY_KEY = 'afridev.text-only';

/**
 * Script exécuté avant l'affichage : applique le thème et le mode texte sans flash.
 */
export const preferencesScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('${THEME_KEY}')||'system';var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);d.dataset.theme=dark?'dark':'light';var m=localStorage.getItem('${TEXT_ONLY_KEY}')||'auto';var c=navigator.connection;var weak=c&&(c.saveData||/2g|3g/.test(c.effectiveType||''));if(m==='on'||(m==='auto'&&weak))d.setAttribute('data-text-only','');}catch(e){}})();`;

export function useTheme() {
  return useLocalPreference<ThemePreference>(THEME_KEY, 'system');
}

/** Garde html[data-theme] à jour et injecte le script d'initialisation côté serveur sans warning React 19. */
export function ThemeSync() {
  const [theme] = useTheme();

  useServerInsertedHTML(() => (
    <script
      id="afridev-preferences-init"
      dangerouslySetInnerHTML={{ __html: preferencesScript }}
    />
  ));

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return null;
}
