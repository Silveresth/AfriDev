import { type HubIconLucide, resolveHubIcon } from '@afridev/validation';
import {
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  Cloud,
  Code2,
  Cpu,
  Database,
  Gamepad2,
  GitBranch,
  Globe,
  GraduationCap,
  type LucideIcon,
  Palette,
  Rocket,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/shared/lib';

import { communityColor } from './Tag';

/** Composants Lucide du catalogue partagé (packages/validation, HUB_ICONS). */
export const HUB_ICON_COMPONENTS: Record<HubIconLucide, LucideIcon> = {
  Code2,
  Terminal,
  Globe,
  Smartphone,
  Server,
  Cloud,
  Database,
  BarChart3,
  Bot,
  ShieldCheck,
  Wallet,
  Palette,
  Gamepad2,
  Cpu,
  GitBranch,
  GraduationCap,
  Briefcase,
  Rocket,
  Users,
  CalendarDays,
};

/**
 * Icône d'un hub : pictogramme du catalogue sur sa couleur (0 octet réseau), image (masquée en
 * mode « Texte seul »), ou initiale sur une couleur stable.
 */
export function HubIcon({
  icon,
  name,
  size = 24,
  className,
}: {
  icon?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const resolved = resolveHubIcon(icon);
  const Glyph = resolved.kind === 'icon' ? HUB_ICON_COMPONENTS[resolved.icon.lucide] : null;
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md font-semibold text-white uppercase',
        resolved.kind === 'initial' && communityColor(name),
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.45),
        backgroundColor: resolved.kind === 'icon' ? resolved.icon.color : undefined,
      }}
    >
      {Glyph ? <Glyph style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2.2} /> : null}
      {resolved.kind === 'initial' ? name.slice(0, 1) : null}
      {resolved.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element -- icône externe légère
        <img src={resolved.url} alt="" data-media loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : null}
    </span>
  );
}

/** « h/python-afrique » avec son icône, vers la page du hub. */
export function HubLink({
  hub,
  className,
  iconSize = 14,
}: {
  hub: { slug: string; name: string; icon?: string | null };
  className?: string;
  iconSize?: number;
}) {
  return (
    <Link
      href={`/h/${hub.slug}`}
      title={hub.name}
      className={cn('inline-flex min-w-0 items-center gap-1 font-medium text-ink-muted hover:text-ink hover:underline', className)}
    >
      <HubIcon icon={hub.icon} name={hub.name} size={iconSize} className="rounded-[4px]" />
      <span className="truncate">h/{hub.slug}</span>
    </Link>
  );
}
