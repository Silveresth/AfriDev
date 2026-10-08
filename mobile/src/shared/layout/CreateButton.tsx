import { router } from 'expo-router';
import { type LucideIcon, MessageCircleQuestion, PenLine, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';

import { type Key, useT } from '@/shared/i18n';
import { haptic, PressableScale, SPRING } from '@/shared/motion';
import { useRequireAuth } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { ForwardChevron, Sheet, Text } from '@/shared/ui';

interface Choice {
  href: string;
  title: Key;
  hint: Key;
  icon: LucideIcon;
}

const CHOICES: Choice[] = [
  { href: '/compose/post', title: 'publish.post', hint: 'publish.post_hint', icon: PenLine },
  { href: '/compose/question', title: 'publish.question', hint: 'publish.question_hint', icon: MessageCircleQuestion },
];

/**
 * Bouton rond « + » en bas à droite, à portée du pouce : il surgit à l'ouverture de l'écran et
 * pivote en « × » quand la feuille de choix est ouverte. `href` : action directe.
 */
export function CreateButton({ href, params }: { href?: string; params?: Record<string, string> }) {
  const { colors } = useTheme();
  const { t } = useT();
  const requireAuth = useRequireAuth();
  const [open, setOpen] = useState(false);
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withSpring(open ? 1 : 0, SPRING);
  }, [open, turn]);
  const icon = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 135}deg` }] }));

  const go = (target: string) => {
    setOpen(false);
    router.push({ pathname: target as never, params });
  };

  return (
    <>
      <Animated.View entering={ZoomIn.springify().damping(12).delay(250)} style={styles.anchor}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('create.label')}
          scaleTo={0.88}
          onPress={() => {
            haptic.tap();
            requireAuth(() => (href ? go(href) : setOpen(true)));
          }}
          style={[styles.fab, { backgroundColor: colors.primary }]}
        >
          <Animated.View style={icon}>
            <Plus size={26} color={colors.onPrimary} strokeWidth={2.4} />
          </Animated.View>
        </PressableScale>
      </Animated.View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('create.label')}>
        {CHOICES.map((choice, index) => (
          <Animated.View key={choice.href} entering={FadeInDown.delay(80 + index * 70).duration(280)}>
            <PressableScale onPress={() => go(choice.href)} scaleTo={0.98} style={styles.choice}>
              <View style={[styles.choiceIcon, { backgroundColor: colors.primarySoft }]}>
                <choice.icon size={20} color={colors.primaryInk} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{t(choice.title)}</Text>
                <Text variant="small" tone="muted">
                  {t(choice.hint)}
                </Text>
              </View>
              <ForwardChevron size={18} color={colors.inkFaint} />
            </PressableScale>
          </Animated.View>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 16, bottom: 16 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  choiceIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
