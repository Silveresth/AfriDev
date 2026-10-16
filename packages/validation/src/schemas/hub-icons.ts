/**
 * Icônes des hubs, communes au web (lucide-react) et au mobile (lucide-react-native) : le hub
 * stocke « icon:<clé> », chaque appli associe la clé au composant Lucide du même nom.
 * Les anciens hubs (émojis) sont rattachés à l'icône équivalente ; une URL reste une image.
 */
export const HUB_ICONS = [
  { key: 'code', lucide: 'Code2', label: 'Développement', color: '#2563EB' },
  { key: 'terminal', lucide: 'Terminal', label: 'Langages & scripts', color: '#0F766E' },
  { key: 'globe', lucide: 'Globe', label: 'Web', color: '#0284C7' },
  { key: 'mobile', lucide: 'Smartphone', label: 'Mobile', color: '#7C3AED' },
  { key: 'server', lucide: 'Server', label: 'Backend & DevOps', color: '#475569' },
  { key: 'cloud', lucide: 'Cloud', label: 'Cloud', color: '#0EA5E9' },
  { key: 'database', lucide: 'Database', label: 'Données', color: '#B45309' },
  { key: 'chart', lucide: 'BarChart3', label: 'Data & analyse', color: '#C2410C' },
  { key: 'ai', lucide: 'Bot', label: 'Intelligence artificielle', color: '#9333EA' },
  { key: 'security', lucide: 'ShieldCheck', label: 'Sécurité', color: '#15803D' },
  { key: 'fintech', lucide: 'Wallet', label: 'Fintech & paiements', color: '#16A34A' },
  { key: 'design', lucide: 'Palette', label: 'Design & UX', color: '#DB2777' },
  { key: 'game', lucide: 'Gamepad2', label: 'Jeux vidéo', color: '#E11D48' },
  { key: 'hardware', lucide: 'Cpu', label: 'Hardware & IoT', color: '#4F46E5' },
  { key: 'opensource', lucide: 'GitBranch', label: 'Open source', color: '#EA580C' },
  { key: 'learning', lucide: 'GraduationCap', label: 'Apprentissage', color: '#CA8A04' },
  { key: 'career', lucide: 'Briefcase', label: 'Carrière & emploi', color: '#A16207' },
  { key: 'startup', lucide: 'Rocket', label: 'Startups', color: '#C84B20' },
  { key: 'community', lucide: 'Users', label: 'Communauté locale', color: '#0D9488' },
  { key: 'events', lucide: 'CalendarDays', label: 'Événements', color: '#BE123C' },
] as const;

export type HubIconKey = (typeof HUB_ICONS)[number]['key'];
export type HubIconLucide = (typeof HUB_ICONS)[number]['lucide'];
export type HubIconMeta = (typeof HUB_ICONS)[number];

export const DEFAULT_HUB_ICON: HubIconKey = 'code';

/** Émojis proposés par l'ancien formulaire → icône équivalente. */
const LEGACY_EMOJIS: Record<string, HubIconKey> = {
  '💻': 'code',
  '🐍': 'terminal',
  '📱': 'mobile',
  '💸': 'fintech',
  '☁️': 'cloud',
  '☁': 'cloud',
  '🤖': 'ai',
  '🎨': 'design',
  '🔐': 'security',
  '🌍': 'community',
  '⚡': 'startup',
};

const BY_KEY = new Map<string, HubIconMeta>(HUB_ICONS.map((icon) => [icon.key, icon]));

export function hubIconValue(key: HubIconKey): string {
  return `icon:${key}`;
}

/** Ce qu'il faut afficher pour la valeur `icon` d'un hub. */
export function resolveHubIcon(
  value: string | null | undefined,
): { kind: 'icon'; icon: HubIconMeta } | { kind: 'image'; url: string } | { kind: 'initial' } {
  const raw = (value ?? '').trim();
  if (/^https?:\/\//.test(raw)) return { kind: 'image', url: raw };
  const key = raw.startsWith('icon:') ? raw.slice(5) : LEGACY_EMOJIS[raw];
  const icon = key ? BY_KEY.get(key) : undefined;
  return icon ? { kind: 'icon', icon } : { kind: 'initial' };
}
