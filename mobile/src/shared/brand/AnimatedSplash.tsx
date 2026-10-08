import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/shared/i18n';

import { BRAND_GREEN, BRAND_TERRACOTTA, BrandMark } from './BrandMark';

const WORD = 'AfriDev';
const MIN_DURATION = 2100;
const LOGO = 128;

function Letter({ char, index }: { char: string; index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(820 + index * 55, withSpring(1, { damping: 14, stiffness: 160 }));
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.85 + progress.value * 0.15 }],
  }));
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

function PulseRing({ delay }: { delay: number }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [delay, ring]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.55,
    transform: [{ scale: 0.4 + ring.value * 2.2 }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

/**
 * Splash animé, enchaîné sans couture sur le splash natif (même fond, même logo, même taille) :
 * 1. les chevrons se resserrent puis s'ouvrent comme une balise de code ;
 * 2. le point vert « bat » et diffuse des ondes ;
 * 3. le nom et la signature montent lettre par lettre ;
 * 4. sortie : le logo plonge vers l'écran et le fond s'efface sur l'appli.
 */
export function AnimatedSplash({ ready, onFinish, onLayout }: { ready: boolean; onFinish: () => void; onLayout?: () => void }) {
  const { width } = useWindowDimensions();
  const [minElapsed, setMinElapsed] = useState(false);

  const open = useSharedValue(0);
  const dot = useSharedValue(1);
  const tagline = useSharedValue(0);
  const bar = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    // Départ = splash natif ; anticipation (les chevrons se resserrent), puis rebond élastique.
    open.value = withSequence(
      withTiming(-0.4, { duration: 280, easing: Easing.inOut(Easing.quad) }),
      withSpring(0, { damping: 7, stiffness: 140 }),
    );
    dot.value = withSequence(
      withTiming(0.4, { duration: 260 }),
      withSpring(1.35, { damping: 6, stiffness: 220 }),
      withSpring(1, { damping: 10 }),
    );
    tagline.value = withDelay(1250, withTiming(1, { duration: 500 }));
    bar.value = withTiming(0.85, { duration: MIN_DURATION, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(() => setMinElapsed(true), MIN_DURATION);
    return () => clearTimeout(timer);
  }, [bar, dot, open, tagline]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    bar.value = withTiming(1, { duration: 180 });
    exit.value = withDelay(
      160,
      withTiming(1, { duration: 520, easing: Easing.bezier(0.7, 0, 0.84, 0) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [bar, exit, minElapsed, onFinish, ready]);

  const shift = LOGO * 0.14;
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -open.value * shift }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: open.value * shift }] }));
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + exit.value * 5 }],
    opacity: 1 - exit.value * 1.4,
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value * 3 }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value * 0.85,
    transform: [{ translateY: (1 - tagline.value) * 8 }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%`, opacity: 1 - exit.value * 3 }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: exit.value < 0.6 ? 1 : 1 - (exit.value - 0.6) / 0.4 }));

  return (
    <Animated.View
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      pointerEvents={ready && minElapsed ? 'none' : 'auto'}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.logo, logoStyle]}>
          <View style={styles.rings}>
            <PulseRing delay={700} />
            <PulseRing delay={1400} />
          </View>
          <BrandMark size={LOGO} leftStyle={leftStyle} rightStyle={rightStyle} dotStyle={dotStyle} />
        </Animated.View>
        <Animated.View style={[styles.word, textStyle]}>
          {WORD.split('').map((char, index) => (
            <Letter key={index} char={char} index={index} />
          ))}
        </Animated.View>
        <Animated.Text style={[styles.tagline, taglineStyle, textStyle]}>{t('splash.tagline')}</Animated.Text>
      </View>
      <View style={[styles.track, { width: Math.min(160, width * 0.4) }]}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
      <Text style={styles.hidden}>{t('state.loading')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BRAND_TERRACOTTA, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  center: { alignItems: 'center' },
  logo: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' },
  rings: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: BRAND_GREEN },
  word: { flexDirection: 'row', marginTop: 8 },
  letter: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#FFFFFF', fontSize: 14, marginTop: 6, fontWeight: '500' },
  track: { position: 'absolute', bottom: 72, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  hidden: { position: 'absolute', opacity: 0 },
});
