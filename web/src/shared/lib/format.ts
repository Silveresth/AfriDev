const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** « il y a 2 h », « hier »… */
export function timeAgo(date: string | Date, now = Date.now()): string {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "à l'instant";
}

/** 1 536 -> « 1,5 Ko » */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('fr', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

export function formatCount(value: number): string {
  // Valeur absolue : un score de vote peut être négatif (-1,2k).
  return Math.abs(value) >= 1000 ? `${(value / 1000).toLocaleString('fr', { maximumFractionDigits: 1 })}k` : String(value);
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

/** Taille approximative d'un texte encodé en UTF-8 (indicateur d'empreinte data). */
export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** « 1 réponse », « 3 réponses » (pluriel régulier par défaut). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}