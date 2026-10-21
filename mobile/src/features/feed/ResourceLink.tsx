import { linkDomain } from '@afridev/validation';
import { ExternalLink, Globe } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { openLink } from '@/shared/lib';
import { PressableScale } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

/** Ressource externe d'un post : domaine, adresse, et ouverture dans le navigateur interne. */
export function ResourceLink({ url, large = false }: { url: string; large?: boolean }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityRole="link"
      accessibilityLabel={`${t('post.open_resource')} : ${linkDomain(url)}`}
      onPress={() => void openLink(url)}
      style={[styles.box, { borderColor: colors.line, backgroundColor: colors.container }, large && styles.large]}
    >
      <View style={[styles.icon, { backgroundColor: colors.background }]}>
        <Globe size={large ? 20 : 16} color={colors.primaryInk} />
      </View>
      <View style={styles.flex}>
        <Text variant="smallStrong" numberOfLines={1}>
          {linkDomain(url)}
        </Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {url.replace(/^https?:\/\/(www\.)?/i, '')}
        </Text>
      </View>
      {large ? (
        <Text variant="smallStrong" tone="primary">
          {t('post.open_resource')}
        </Text>
      ) : null}
      <ExternalLink size={16} color={colors.primaryInk} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  large: { paddingHorizontal: 12, paddingVertical: 12 },
  icon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 1 },
});
