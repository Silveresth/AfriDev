import { type Key, t } from '@/shared/i18n';

/**
 * Couleur d'accent d'un profil (bannière, avatar) : choisie par le membre, ou attribuée de façon
 * stable à partir de son pseudo. Mêmes valeurs que web/src/shared/ui/profileColor.ts.
 */
export const PROFILE_COLORS = {
  indigo: { label: 'Indigo', hex: '#4f46e5' },
  blue: { label: 'Bleu', hex: '#2563eb' },
  cyan: { label: 'Cyan', hex: '#0e7490' },
  teal: { label: 'Sarcelle', hex: '#0f766e' },
  emerald: { label: 'Émeraude', hex: '#047857' },
  lime: { label: 'Olive', hex: '#4d7c0f' },
  amber: { label: 'Ambre', hex: '#b45309' },
  terracotta: { label: 'Terre cuite', hex: '#c2410c' },
  rose: { label: 'Rose', hex: '#be123c' },
  violet: { label: 'Violet', hex: '#7c3aed' },
  slate: { label: 'Ardoise', hex: '#475569' },
} as const;

export type ProfileColor = keyof typeof PROFILE_COLORS;

const KEYS = Object.keys(PROFILE_COLORS) as ProfileColor[];

export function profileColor(username: string, chosen?: string | null): ProfileColor {
  if (chosen && chosen in PROFILE_COLORS) return chosen as ProfileColor;
  let hash = 0;
  for (const char of username.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return KEYS[Math.abs(hash) % KEYS.length] ?? 'terracotta';
}

export const profileColorHex = (username: string, chosen?: string | null) => PROFILE_COLORS[profileColor(username, chosen)].hex;

const LANGUAGE_COLORS: Record<string, string> = {
  python: '#3572A5',
  javascript: '#f1e05a',
  typescript: '#3178c6',
  java: '#b07219',
  kotlin: '#A97BFF',
  swift: '#F05138',
  dart: '#00B4AB',
  go: '#00ADD8',
  rust: '#dea584',
  php: '#4F5D95',
  ruby: '#701516',
  c: '#555555',
  'c++': '#f34b7d',
  cpp: '#f34b7d',
  'c#': '#178600',
  csharp: '#178600',
  bash: '#89e051',
  shell: '#89e051',
  sql: '#e38c00',
  html: '#e34c26',
  css: '#663399',
  json: '#cbcb41',
  yaml: '#cb171e',
  dockerfile: '#384d54',
};

/** Pastille de langage, comme GitHub. */
export function languageColor(language: string | null | undefined): string {
  return LANGUAGE_COLORS[(language ?? '').toLowerCase()] ?? '#8b949e';
}

const month = (d: Date) => t(`month.${d.getUTCMonth()}` as Key);

/** « octobre 2026 » dans la langue active (écrit à la main : Intl n'est pas fiable sous Hermes). */
export function monthYear(date: string | Date): string {
  const d = new Date(date);
  return `${month(d)} ${d.getUTCFullYear()}`;
}

/** « 12 mars 2027 ». */
export function longDate(date: string | Date): string {
  const d = new Date(date);
  return `${d.getUTCDate()} ${month(d)} ${d.getUTCFullYear()}`;
}
