import { type HubIconLucide, resolveHubIcon } from '@afridev/validation';
import { Image } from 'expo-image';
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
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AVATAR_COLORS, radius } from '@/shared/theme';

/** Composants Lucide du catalogue partagé avec le web (packages/validation, HUB_ICONS). */
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

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Icône d'un hub : pictogramme du catalogue sur sa couleur, image, ou initiale sur une couleur stable. */
export function HubIcon({ icon, name, size = 40 }: { icon?: string | null; name: string; size?: number }) {
  const resolved = resolveHubIcon(icon);
  const Glyph = resolved.kind === 'icon' ? HUB_ICON_COMPONENTS[resolved.icon.lucide] : null;
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size > 48 ? radius.lg : radius.md,
          backgroundColor: resolved.kind === 'icon' ? resolved.icon.color : colorFor(name),
        },
      ]}
    >
      {Glyph ? <Glyph size={size * 0.55} color="#FFFFFF" strokeWidth={2.2} /> : null}
      {resolved.kind === 'initial' ? (
        <Text style={{ fontSize: size * 0.45, fontWeight: '700', color: '#FFFFFF' }}>{name.slice(0, 1).toUpperCase()}</Text>
      ) : null}
      {resolved.kind === 'image' ? <Image source={{ uri: resolved.url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
