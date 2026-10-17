import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { PUBLIC_WEB_URL } from '@/shared/api';
import { type Key, t } from '@/shared/i18n';

export { languageColor, longDate, monthYear, PROFILE_COLORS, type ProfileColor, profileColor, profileColorHex } from './colors';

const UNITS: [number, string][] = [
  [365 * 24 * 3600, 'time.y'],
  [30 * 24 * 3600, 'time.mo'],
  [7 * 24 * 3600, 'time.w'],
  [24 * 3600, 'time.d'],
  [3600, 'time.h'],
  [60, 'time.min'],
];

/**
 * « il y a 2 h », « 3 d ago »… dans la langue active. Écrit à la main : Hermes (moteur JS du
 * mobile) n'a pas Intl.RelativeTimeFormat, et l'appeler fait planter l'appli.
 */
export function timeAgo(date: string | Date | null | undefined, now = Date.now()): string {
  if (!date) return '';
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  for (const [size, unit] of UNITS) {
    if (seconds >= size) {
      const value = Math.floor(seconds / size);
      const label = unit === 'time.y' ? t(value > 1 ? 'time.y.other' : 'time.y.one') : t(unit as Key);
      return t('time.ago', { value, unit: label });
    }
  }
  return t('time.now');
}

/** 1536 -> « 1,5k » ; un score de vote peut être négatif. */
export function formatCount(value: number | null | undefined): string {
  const n = value ?? 0;
  if (Math.abs(n) < 1000) return String(n);
  const k = Math.round((n / 1000) * 10) / 10;
  return `${String(k).replace('.', ',')}k`;
}

export function initials(name: string): string {
  return (
    name
      .split(/[\s_.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** Markdown -> texte brut d'une ligne (aperçus dans les listes). */
export function plainText(markdown: string, length = 180): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

/** Domaine affiché sous un lien : « techcrunch.com ». */
export function domainOf(url: string): string {
  const match = url.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
  return match?.[1] ?? '';
}

/**
 * Tente de convertir une URL absolue ou relative en route interne mobile.
 * Exemples supportés :
 * - https://afridev.duckdns.org/post/123 -> /post/123
 * - https://afridev.duckdns.org/feed/123 -> /post/123
 * - /post/123 ou /feed/123 -> /post/123
 * - https://.../questions/456 ou /questions/456 -> /question/456
 * - https://.../question/456 ou /question/456 -> /question/456
 * - https://.../h/slug -> /h/slug
 * - https://.../u/username -> /u/username
 * - afridev://post/123 -> /post/123
 */
export function resolveInternalRoute(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Schéma personnalisé natif : afridev://...
  if (/^afridev:\/\//i.test(trimmed)) {
    const path = trimmed.replace(/^afridev:\/\//i, '/');
    return normalizeInternalPath(path);
  }

  // URL interne relative
  if (trimmed.startsWith('/')) {
    return normalizeInternalPath(trimmed);
  }

  // Vérifier si l'URL pointe vers le domaine de l'application Web AfriDev ou localhost
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isAfriDevDomain =
      host === 'afridev.duckdns.org' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.afridev.org') ||
      (PUBLIC_WEB_URL && (parsed.origin === new URL(PUBLIC_WEB_URL).origin || host === new URL(PUBLIC_WEB_URL).hostname.toLowerCase()));

    if (isAfriDevDomain) {
      return normalizeInternalPath(parsed.pathname);
    }
  } catch {
    // URL invalide pour new URL(), vérifions les chemins relatifs directs
    if (trimmed.startsWith('/')) {
      return normalizeInternalPath(trimmed);
    }
  }

  return null;
}

function normalizeInternalPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '');
  
  // Post : /post/[id] ou /feed/[id] (route web) -> /post/[id]
  const postMatch = clean.match(/^\/(?:post|feed)\/([^/?#]+)/i);
  if (postMatch) return `/post/${postMatch[1]}`;

  // Question : /question/[id] ou /questions/[id] -> /question/[id]
  const questionMatch = clean.match(/^\/(?:question|questions)\/([^/?#]+)/i);
  if (questionMatch) return `/question/${questionMatch[1]}`;

  // Snippet : /snippets/[id] (route web) ou /snippet/[id] -> /snippet/[id]
  const snippetMatch = clean.match(/^\/snippets?\/([0-9a-f-]{36})$/i);
  if (snippetMatch) return `/snippet/${snippetMatch[1]}`;

  // Hub : /h/[slug] -> /h/[slug]
  const hubMatch = clean.match(/^\/h\/([^/?#]+)/i);
  if (hubMatch) return `/h/${hubMatch[1]}`;

  // Profil : /u/[username] -> /u/[username]
  const userMatch = clean.match(/^\/u\/([^/?#]+)/i);
  if (userMatch) return `/u/${userMatch[1]}`;

  // Écran notifications : /notifications -> /notifications
  if (clean === '/notifications') return '/notifications';

  // Onglets principaux
  if (clean === '/feed' || clean === '/') return '/(tabs)/feed';
  if (clean === '/news') return '/(tabs)/news';
  if (clean === '/questions') return '/(tabs)/questions';
  if (clean === '/hubs') return '/(tabs)/hubs';

  return null;
}

/**
 * Écran d'une notification d'après data = {type, id} (posts, questions et profils ont un écran
 * dans l'appli). Partagé par la liste des notifications et l'ouverture d'une notification push.
 */
export function notificationRoute(data: unknown): string | null {
  const { type, id } = (data ?? {}) as { type?: string; id?: string };
  if (!id) return null;
  if (type === 'post') return `/post/${id}`;
  if (type === 'question') return `/question/${id}`;
  if (type === 'snippet') return `/snippet/${id}`;
  if (type === 'profile') return `/u/${id}`;
  return null;
}

/** Notifications sans écran dans l'appli (projet, guide, espace contributeur) : page du site. */
export function notificationWebUrl(data: unknown): string | null {
  const { type, id } = (data ?? {}) as { type?: string; id?: string };
  if (!id) return null;
  const path = { project: `/projects/${id}`, guide: `/projects/guides/${id}`, welcome: `/projects/welcome/${id}` }[type ?? ''];
  return path ? `${PUBLIC_WEB_URL}${path}` : null;
}

/** Ouvre un lien dans l'application si c'est une ressource interne, ou dans le navigateur intégré. */
export function openLink(url: string) {
  const internalRoute = resolveInternalRoute(url);
  if (internalRoute) {
    try {
      router.push(internalRoute as any);
      return Promise.resolve();
    } catch {
      // repli navigateur si le routage échoue
    }
  }

  return WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: '#C84B20',
  }).catch(() => undefined);
}
