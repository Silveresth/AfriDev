import { ArrowBigDown, ArrowBigUp } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useRequireAuth } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';

import { type Post, useScoreVote } from './api';

function Arrow({ up, active, color, onPress }: { up: boolean; active: boolean; color: string; onPress: () => void }) {
  const pop = useSharedValue(1);
  const lift = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { translateY: lift.value }] }));
  const Icon = up ? ArrowBigUp : ArrowBigDown;
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(up ? 'feed.upvote' : 'feed.downvote')}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      onPress={() => {
        // La flèche bondit dans son sens puis retombe.
        pop.value = withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, { damping: 6, stiffness: 240 }));
        lift.value = withSequence(withTiming(up ? -4 : 4, { duration: 110 }), withSpring(0, { damping: 8 }));
        onPress();
      }}
      style={styles.arrow}
    >
      <Animated.View style={style}>
        <Icon size={20} color={color} fill={active ? color : 'transparent'} strokeWidth={1.8} />
      </Animated.View>
    </Pressable>
  );
}

/** Capsule ↑ score ↓ : terre cuite pour ↑, violet pour ↓ ; retoucher la même flèche retire le vote. */
export function VoteCapsule({ post }: { post: Post }) {
  const { colors } = useTheme();
  const requireAuth = useRequireAuth();
  const vote = useScoreVote(post);
  const current = post.viewer?.post_vote ?? 0;
  const tint = current === 1 ? colors.primary : current === -1 ? colors.downvote : colors.inkMuted;

  // Le fond glisse en douceur entre neutre, terre cuite pâle et violet pâle.
  const state = useSharedValue(current);
  useEffect(() => {
    state.value = withTiming(current, { duration: 220 });
  }, [current, state]);
  const capsule = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(state.value, [-1, 0, 1], [colors.downvoteSoft, colors.container, colors.primarySoft]),
  }));

  // Sens du défilement du chiffre : il monte si le score augmente.
  const previous = useRef(post.score);
  const rising = post.score >= previous.current;
  useEffect(() => {
    previous.current = post.score;
  }, [post.score]);

  const cast = (value: 1 | -1) =>
    requireAuth(() => {
      haptic.tap();
      vote.mutate(current === value ? 0 : value);
    });

  return (
    <Animated.View style={[styles.capsule, capsule]}>
      <Arrow up active={current === 1} color={tint} onPress={() => cast(1)} />
      <View style={styles.scoreBox}>
        <Animated.Text
          key={post.score}
          entering={(rising ? FadeInUp : FadeInDown).duration(200)}
          exiting={(rising ? FadeOutUp : FadeOutDown).duration(160)}
          style={[typography.smallStrong, styles.score, { color: current ? tint : colors.ink }]}
        >
          {formatCount(post.score)}
        </Animated.Text>
      </View>
      <Arrow up={false} active={current === -1} color={tint} onPress={() => cast(-1)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  capsule: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: radius.pill, paddingHorizontal: 4 },
  arrow: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  scoreBox: { minWidth: 24, height: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  score: { position: 'absolute', textAlign: 'center' },
});
