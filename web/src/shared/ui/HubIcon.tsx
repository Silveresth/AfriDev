import Link from 'next/link';

import { cn } from '@/shared/lib';

import { communityColor } from './Tag';

/**
 * Icône d'un hub : émoji (0 octet réseau), image (masquée en mode « Texte seul »),
 * ou initiale sur une couleur stable.
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
  const isImage = Boolean(icon && /^https?:\/\//.test(icon));
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md font-semibold text-white uppercase',
        icon && !isImage ? 'border border-line bg-container-low' : communityColor(name),
        className,
      )}
      style={{ width: size, height: size, fontSize: icon && !isImage ? size * 0.58 : Math.max(10, size * 0.45) }}
    >
      {icon && !isImage ? icon : name.slice(0, 1)}
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- icône externe légère
        <img src={icon!} alt="" data-media loading="lazy" className="absolute inset-0 size-full object-cover" />
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
