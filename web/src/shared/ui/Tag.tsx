import Link from 'next/link';

import { cn } from '@/shared/lib';

/** Tag technique (#python), façon Dev.to : discret, souligné d'un filet au survol. */
export function Tag({
  children,
  href,
  hash = true,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  hash?: boolean;
  className?: string;
}) {
  const classes = cn(
    'inline-flex h-6 items-center rounded-md border border-transparent px-1.5 text-label-md font-medium text-ink-muted',
    href && 'transition-colors hover:border-line hover:bg-container-low hover:text-ink',
    className,
  );
  const content = (
    <>
      {hash ? <span className="mr-px text-ink-faint">#</span> : null}
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}

const COMMUNITY_COLORS = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-[#7c3aed]', 'bg-[#0e7490]', 'bg-[#be185d]'];

export function communityColor(tag: string) {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COMMUNITY_COLORS[Math.abs(hash) % COMMUNITY_COLORS.length]!;
}

/** Icône ronde d'une communauté (initiale sur couleur stable). */
export function CommunityIcon({ tag, size = 24, className }: { tag: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white uppercase',
        communityColor(tag),
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.45) }}
    >
      {tag.slice(0, 1)}
    </span>
  );
}

/** Communauté « d/python » : un tag vu comme un espace de discussion. */
export function CommunityLink({ tag, className }: { tag: string; className?: string }) {
  return (
    <Link
      href={`/feed?tag=${encodeURIComponent(tag)}`}
      className={cn('inline-flex items-center gap-1.5 text-body-sm font-semibold text-ink hover:underline', className)}
    >
      <CommunityIcon tag={tag} size={20} />d/{tag}
    </Link>
  );
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'offline';

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-container-low text-ink-muted',
  primary: 'border-primary/20 bg-primary-soft text-primary-ink',
  success: 'border-secondary/25 bg-secondary-soft text-on-secondary-soft',
  warning: 'border-tertiary/25 bg-tertiary-soft text-on-tertiary-soft',
  danger: 'border-danger/20 bg-danger-soft text-on-danger-soft',
  offline: 'border-line bg-container text-offline',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  primary: 'bg-primary',
  success: 'bg-secondary',
  warning: 'bg-tertiary',
  danger: 'bg-danger',
  offline: 'bg-offline',
};

/** Badge d'état façon shadcn/ui (« Résolue », « En attente de réseau ») : capsule à filet teinté. */
export function StatusBadge({
  tone = 'neutral',
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-label-md font-medium whitespace-nowrap [&_svg]:shrink-0',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Alias shadcn/ui : `<Badge tone="success">`. */
export const Badge = StatusBadge;

/** Pastille numérique (notifications non lues). */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold text-on-primary',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
