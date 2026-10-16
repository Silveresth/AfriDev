import { Award, BadgeCheck, Crown, HandHelping, type LucideIcon, Rocket } from 'lucide-react-native';

/** Statuts spéciaux affichés en icône à côté du pseudo ; les autres badges gardent Award. */
export const SPECIAL_BADGES: Record<string, { icon: LucideIcon; color: string }> = {
  'mentor-communautaire': { icon: Crown, color: '#D97706' },
  'lead-contributor': { icon: Rocket, color: '#7C3AED' },
  'top-5-entraide': { icon: HandHelping, color: '#15803D' },
  'contributeur-majeur': { icon: BadgeCheck, color: '#C84B20' },
};

export const badgeIcon = (code: string): LucideIcon => SPECIAL_BADGES[code]?.icon ?? Award;
