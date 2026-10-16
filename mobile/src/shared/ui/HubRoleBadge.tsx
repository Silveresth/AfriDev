import { Pin, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';

import { Text } from './Text';

/** Rôle de l'auteur dans le hub du contenu (« Créateur du hub » / « Modérateur ») ; rien sinon. */
export function HubRoleBadge({ role }: { role?: string | null }) {
  const { colors } = useTheme();
  const { t } = useT();
  if (role !== 'creator' && role !== 'moderator') return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.secondarySoft }]}>
      <ShieldCheck size={11} color={colors.secondaryInk} />
      <Text variant="caption" style={[styles.label, { color: colors.secondaryInk }]}>
        {t(role === 'creator' ? 'mod.creator' : 'mod.moderator')}
      </Text>
    </View>
  );
}

/** Post épinglé en tête de son hub. */
export function PinnedBadge() {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
      <Pin size={11} color={colors.primaryInk} />
      <Text variant="caption" style={[styles.label, { color: colors.primaryInk }]}>
        {t('mod.pinned')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  label: { fontWeight: '700' },
});
