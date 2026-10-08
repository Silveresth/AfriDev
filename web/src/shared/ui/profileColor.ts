/**
 * Couleur d'accent d'un profil (bannière, avatar) : choisie par le membre, ou attribuée de façon
 * stable à partir de son pseudo. Teintes assez soutenues pour porter du texte blanc, dans les deux thèmes.
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

/** Couleur attribuée par défaut : toujours la même pour un pseudo donné. */
export function defaultProfileColor(username: string): ProfileColor {
  let hash = 0;
  for (const char of username.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return KEYS[Math.abs(hash) % KEYS.length]!;
}

export function profileColor(username: string, chosen?: string | null): ProfileColor {
  return chosen && chosen in PROFILE_COLORS ? (chosen as ProfileColor) : defaultProfileColor(username);
}

export const profileColorHex = (username: string, chosen?: string | null) => PROFILE_COLORS[profileColor(username, chosen)].hex;
