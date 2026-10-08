import * as WebBrowser from 'expo-web-browser';

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

/** Ouvre un lien externe dans le navigateur intégré (l'utilisateur reste dans l'appli). */
export function openLink(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: '#C84B20',
  }).catch(() => undefined);
}
