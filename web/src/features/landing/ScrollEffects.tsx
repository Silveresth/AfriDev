'use client';

import { useEffect } from 'react';

/**
 * Effets de défilement de la page d'accueil, sans bibliothèque :
 * - `[data-reveal]` : reçoit `data-in` à son entrée à l'écran (une seule fois) ;
 * - `[data-progress]` : reçoit `--progress` (0 → 1) selon sa traversée de l'écran,
 *   utilisé pour la parallaxe des téléphones et la ligne des étapes.
 * Ne rend rien ; respecte prefers-reduced-motion (tout est affiché d'emblée).
 */
export function ScrollEffects() {
  useEffect(() => {
    (window as unknown as { __revealOn?: boolean }).__revealOn = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealables = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (reduced || !('IntersectionObserver' in window)) {
      revealables.forEach((el) => el.setAttribute('data-in', ''));
      document.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => el.style.setProperty('--progress', '1'));
      return;
    }

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-in', '');
          reveal.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    revealables.forEach((el) => reveal.observe(el));

    // Progression de défilement, calculée seulement pour les blocs visibles, une fois par image.
    const tracked = Array.from(document.querySelectorAll<HTMLElement>('[data-progress]'));
    const visible = new Set<HTMLElement>();
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      visible.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // 0 quand le haut du bloc touche le bas de l'écran, 1 quand son milieu atteint 40 % de la hauteur.
        const p = (vh - rect.top) / (vh * 0.6 + rect.height / 2);
        el.style.setProperty('--progress', Math.min(1, Math.max(0, p)).toFixed(3));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
        else visible.delete(entry.target as HTMLElement);
      }
      schedule();
    });
    tracked.forEach((el) => watch.observe(el));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      reveal.disconnect();
      watch.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
