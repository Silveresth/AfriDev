import { Award, BadgeCheck, Crown, HandHelping, type LucideIcon, Rocket } from 'lucide-react';

/** Statuts spéciaux mis en avant à côté du pseudo ; les autres badges (expertise) gardent Award. */
export const SPECIAL_BADGES: Record<string, { icon: LucideIcon; className: string }> = {
  'mentor-communautaire': { icon: Crown, className: 'bg-amber-400/15 text-amber-600 ring-amber-500/30 dark:text-amber-300' },
  'lead-contributor': { icon: Rocket, className: 'bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300' },
  'top-5-entraide': { icon: HandHelping, className: 'bg-secondary-soft text-secondary-ink ring-secondary/30' },
  'contributeur-majeur': { icon: BadgeCheck, className: 'bg-primary-soft text-primary-ink ring-primary/30' },
};

export function badgeIcon(code: string): LucideIcon {
  return SPECIAL_BADGES[code]?.icon ?? Award;
}
