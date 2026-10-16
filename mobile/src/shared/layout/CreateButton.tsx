import { router } from 'expo-router';
import { Code2, type LucideIcon, MessageCircleQuestion, PenLine, Plus, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { type Key, useT } from '@/shared/i18n';
import { haptic, PressableScale } from '@/shared/motion';
import { useRequireAuth } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { ForwardChevron, Sheet, Text } from '@/shared/ui';

interface Choice {
  href: string;
  title: Key;
  hint: Key;
  icon: LucideIcon;
  /** Proposé seulement hors d'un hub (on ne crée pas un hub depuis un hub). */
  outsideHub?: boolean;
}

const CHOICES: Choice[] = [
  { href: '/compose/post', title: 'publish.post', hint: 'publish.post_hint', icon: PenLine },
  { href: '/compose/question', title: 'publish.question', hint: 'publish.question_hint', icon: MessageCircleQuestion },
  { href: '/compose/snippet', title: 'publish.snippet', hint: 'snippet.public_hint', icon: Code2 },
  { href: '/compose/hub', title: 'hubs.create', hint: 'hubs.create_hint', icon: UsersRound, outsideHub: true },
];

/**
 * Bouton rond « + » en bas à droite, à portée du pouce : ouvre le choix de ce qu'on publie
 * (post, question, snippet, hub). `href` : action directe. Apparition en simple fondu.
 */
export function CreateButton({ href, params }: { href?: string; params?: Record<string, string> }) {
  const { colors } = useTheme();
  const { t } = useT();
  const requireAuth = useRequireAuth();
  const [open, setOpen] = useState(false);
  const inHub = Boolean(params?.hubId);
  const choices = CHOICES.filter((choice) => !(inHub && choice.outsideHub));

  const go = (target: string) => {
    setOpen(false);
    router.push({ pathname: target as never, params });
  };

  return (
    <>
      <Animated.View entering={FadeIn.duration(200)} style={styles.anchor}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('create.label')}
          scaleTo={0.94}
          onPress={() => {
            haptic.tap();
            requireAuth(() => (href ? go(href) : setOpen(true)));
          }}
          style={[styles.fab, { backgroundColor: colors.primary }]}
        >
          <Plus size={26} color={colors.onPrimary} strokeWidth={2.4} />
        </PressableScale>
      </Animated.View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('create.label')}>
        {choices.map((choice) => (
          <PressableScale key={choice.href} onPress={() => go(choice.href)} scaleTo={0.99} style={styles.choice}>
            <View style={[styles.choiceIcon, { backgroundColor: colors.primarySoft }]}>
              <choice.icon size={20} color={colors.primaryInk} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t(choice.title)}</Text>
              <Text variant="small" tone="muted" numberOfLines={1}>
                {t(choice.hint)}
              </Text>
            </View>
            <ForwardChevron size={18} color={colors.inkFaint} />
          </PressableScale>
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
