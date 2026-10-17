'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { API_URL } from '@/shared/api/config';

import { useOpenInApp } from './InAppBrowser';

// Chemins servis par le backend ou Next (fichiers, API, OAuth) : jamais routés côté client.
const SERVER_PATHS = /^\/(api|media|static|django-admin|_next)(\/|$)/;

/** Chemin interne d'une adresse de la plateforme (même origine ou domaine du site), sinon null. */
export function internalPath(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  const platform = new Set([window.location.origin]);
  try {
    platform.add(new URL(API_URL).origin);
  } catch {
    // API_URL relative : même origine
  }
  if (!platform.has(url.origin) || SERVER_PATHS.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Tout s'ouvre dans la plateforme : les liens internes (même ceux en target="_blank") changent
 * de page sans recharger, les liens externes s'ouvrent dans la visionneuse interne. Ctrl/⌘-clic
 * ou clic molette gardent le comportement du navigateur ; data-external l'impose.
 */
export function LinkInterceptor() {
  const router = useRouter();
  const openInApp = useOpenInApp();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download') || anchor.dataset.external !== undefined) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript):/i.test(href)) return;

      const path = internalPath(href);
      if (path) {
        // Liens internes ouverts « dans un nouvel onglet » : on reste dans le même onglet.
        if (anchor.target === '_blank') {
          event.preventDefault();
          router.push(path);
        }
        return;
      }
      const absolute = new URL(href, window.location.href);
      if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return;
      event.preventDefault();
      openInApp(absolute.href);
    };
    document.addEventListener('click', onClick);

    // window.open(...) vers un site externe : même visionneuse.
    const original = window.open;
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const href = url ? String(url) : '';
      if (href && /^https?:/i.test(href) && !internalPath(href)) {
        openInApp(href);
        return null;
      }
      const path = href ? internalPath(href) : null;
      if (path) {
        router.push(path);
        return null;
      }
      return original.call(window, url, target, features);
    }) as typeof window.open;

    return () => {
      document.removeEventListener('click', onClick);
      window.open = original;
    };
  }, [openInApp, router]);

  return null;
}
