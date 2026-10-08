import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { useRequireAuth } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { type Post, usePollVote } from './api';

/** Barre de résultat qui se remplit depuis la gauche (en cascade d'une option à l'autre). */
function ResultBar({ share, color, delay }: { share: number; color: string; delay: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(delay, withTiming(share, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [delay, share, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/** Avant de voter : options à toucher. Après : barres de résultat (aplats, aucun dégradé). */
export function Poll({ post }: { post: Post }) {
  const { colors } = useTheme();
  const requireAuth = useRequireAuth();
  const { t, tp } = useT();
  const vote = usePollVote(post);
  const chosen = post.viewer?.vote ?? null;
  const results = post.poll_results;
  const total = results?.reduce((sum, n) => sum + n, 0) ?? 0;
  const showResults = chosen !== null && results !== null;

  return (
    <View style={styles.wrap}>
      {post.poll_options.map((option, index) => {
        const count = results?.[index] ?? 0;
        const share = total ? Math.round((count / total) * 100) : 0;
        const mine = chosen === index;
        return (
          <Pressable
            key={index}
            disabled={showResults || vote.isPending}
            onPress={() => requireAuth(() => vote.mutate(index))}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            style={({ pressed }) => [
              styles.option,
              { borderColor: mine ? colors.primary : colors.lineStrong, backgroundColor: pressed ? colors.pressed : colors.background },
            ]}
          >
            {showResults ? (
              <ResultBar share={share} color={mine ? colors.primarySoft : colors.container} delay={index * 80} />
            ) : null}
            <View style={styles.label}>
              {mine ? <Check size={16} color={colors.primaryInk} /> : null}
              <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                {option}
              </Text>
              {showResults ? (
                <Text variant="smallStrong" tone="muted">
                  {share} %
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <Text variant="caption" tone="faint">
        {vote.isError ? errorMessage(vote.error) : showResults ? tp('poll.votes', total) : t('poll.tap')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  option: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center' },
  bar: { ...StyleSheet.absoluteFillObject, right: undefined },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  flex: { flex: 1 },
});
