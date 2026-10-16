import { SOCIAL_NETWORK_KEYS, type SocialNetwork } from '@afridev/validation';
import {
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Code2,
  GitBranch,
  GitMerge,
  Globe,
  type LucideIcon,
  Music2,
  Play,
  UsersRound,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Schemas } from '@/shared/api';
import { openLink } from '@/shared/lib';
import { PressableScale } from '@/shared/motion';
import { useTheme } from '@/shared/theme';

type Links = Schemas['SocialLinks'];
type IconProps = { size?: number; color?: string };

/** Logo X (ex-Twitter). lucide-react-native v1 n'embarque plus de logos de marque. */
function XLogo({ size = 16, color = '#000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </Svg>
  );
}

export const SOCIAL_META: Record<SocialNetwork, { label: string; icon: LucideIcon | typeof XLogo; placeholder: string }> = {
  github: { label: 'GitHub', icon: GitBranch, placeholder: 'https://github.com/pseudo' },
  gitlab: { label: 'GitLab', icon: GitMerge, placeholder: 'https://gitlab.com/pseudo' },
  linkedin: { label: 'LinkedIn', icon: BriefcaseBusiness, placeholder: 'https://linkedin.com/in/pseudo' },
  twitter: { label: 'X (Twitter)', icon: XLogo, placeholder: 'https://x.com/pseudo' },
  tiktok: { label: 'TikTok', icon: Music2, placeholder: 'https://tiktok.com/@pseudo' },
  instagram: { label: 'Instagram', icon: Camera, placeholder: 'https://instagram.com/pseudo' },
  youtube: { label: 'YouTube', icon: Play, placeholder: 'https://youtube.com/@chaine' },
  facebook: { label: 'Facebook', icon: UsersRound, placeholder: 'https://facebook.com/pseudo' },
  dev: { label: 'DEV', icon: Code2, placeholder: 'https://dev.to/pseudo' },
  medium: { label: 'Medium', icon: BookOpen, placeholder: 'https://medium.com/@pseudo' },
  portfolio: { label: 'Portfolio', icon: Globe, placeholder: 'https://mon-site.dev' },
};

/** Ligne d'icônes rondes, une par réseau renseigné (ordre fixe). */
export function SocialLinks({ links }: { links?: Links | null }) {
  const { colors } = useTheme();
  const entries = SOCIAL_NETWORK_KEYS.flatMap((network) => {
    const url = links?.[network];
    return url ? [{ network, url }] : [];
  });
  if (!entries.length) return null;
  return (
    <View style={styles.row}>
      {entries.map(({ network, url }) => {
        const { label, icon: Icon } = SOCIAL_META[network];
        return (
          <PressableScale
            key={network}
            scaleTo={0.88}
            accessibilityRole="link"
            accessibilityLabel={label}
            onPress={() => void openLink(url)}
            style={[styles.icon, { backgroundColor: colors.container, borderColor: colors.line }]}
          >
            <Icon size={17} color={colors.ink} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
});
