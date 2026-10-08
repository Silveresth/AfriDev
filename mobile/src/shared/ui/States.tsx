import type { LucideIcon } from 'lucide-react-native';
import { CloudOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { errorMessage } from '@/shared/api';
import { BrandLoader } from '@/shared/brand';
import { useT } from '@/shared/i18n';
import { Dots, SkeletonList } from '@/shared/motion';
import { useTheme } from '@/shared/theme';

import { Button } from './Button';
import { Text } from './Text';

/** Chargement plein écran : la marque qui respire. Pour une liste, préférer `variant`. */
export function Loading({ variant }: { variant?: 'post' | 'news' | 'row' }) {
  if (variant) return <SkeletonList variant={variant} />;
  return (
    <Animated.View entering={FadeIn.delay(120)} style={styles.center}>
      <BrandLoader />
    </Animated.View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Animated.View
        entering={ZoomIn.springify().damping(11).delay(60)}
        style={[styles.iconWrap, { backgroundColor: colors.container }]}
      >
        <Icon size={26} color={colors.inkMuted} strokeWidth={1.8} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(140).duration(320)} style={styles.texts}>
        <Text variant="headline" style={styles.text}>
          {title}
        </Text>
        {body ? (
          <Text tone="muted" style={styles.text}>
            {body}
          </Text>
        ) : null}
      </Animated.View>
      {action ? (
        <Animated.View entering={FadeInDown.delay(220).duration(320)}>
          <Button label={action.label} onPress={action.onPress} style={styles.action} />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <EmptyState
      icon={CloudOff}
      title={t('state.load_error')}
      body={errorMessage(error)}
      action={onRetry ? { label: t('common.retry'), onPress: onRetry } : undefined}
    />
  );
}

/** Pied de liste : trois points qui sautillent pendant le chargement de la page suivante. */
export function ListFooter({ loading }: { loading: boolean }) {
  return <View style={styles.footer}>{loading ? <Dots /> : null}</View>;
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, minHeight: 320 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  texts: { alignItems: 'center', gap: 6 },
  text: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: 12 },
  footer: { height: 72, alignItems: 'center', justifyContent: 'center' },
});
