import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { dark, light, type Palette } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Point de départ de l'animation (coordonnées écran du doigt). */
export interface RevealOrigin {
  x: number;
  y: number;
}

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference, origin?: RevealOrigin) => void;
}

const THEME_KEY = 'afridev.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

async function readPreference(): Promise<ThemePreference> {
  try {
    const value =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(THEME_KEY) : await SecureStore.getItemAsync(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function writePreference(value: ThemePreference) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(THEME_KEY, value);
    else void SecureStore.setItemAsync(THEME_KEY, value);
  } catch {
    // préférence non retenue : l'appli suit le système au prochain lancement
  }
}

interface Reveal {
  color: string;
  origin: RevealOrigin;
  diameter: number;
}

/**
 * Thème clair / sombre avec transition « encre » : un disque de la nouvelle couleur de fond
 * grandit depuis le doigt, le thème bascule dessous, puis le voile s'efface en fondu.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { width, height } = useWindowDimensions();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const busy = useRef(false);

  const grow = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    void readPreference().then(setPreferenceState);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');
  const colors = isDark ? dark : light;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  const finish = useCallback(() => {
    setReveal(null);
    busy.current = false;
  }, []);

  const commit = useCallback(
    (value: ThemePreference) => {
      setPreferenceState(value);
      // Laisse React peindre le nouveau thème sous le voile avant de l'effacer.
      requestAnimationFrame(() => {
        fade.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }, (done) => {
          if (done) runOnJS(finish)();
        });
      });
    },
    [fade, finish],
  );

  const setPreference = useCallback(
    (value: ThemePreference, origin?: RevealOrigin) => {
      writePreference(value);
      const nextDark = value === 'dark' || (value === 'system' && system === 'dark');
      if (nextDark === isDark || busy.current) {
        setPreferenceState(value);
        return;
      }
      busy.current = true;
      const from = origin ?? { x: width / 2, y: height / 2 };
      // Rayon = distance au coin le plus éloigné : le disque couvre tout l'écran.
      const radiusMax = Math.hypot(Math.max(from.x, width - from.x), Math.max(from.y, height - from.y));
      setReveal({ color: (nextDark ? dark : light).background, origin: from, diameter: radiusMax * 2 + 4 });
      grow.value = 0;
      fade.value = 1;
      grow.value = withTiming(1, { duration: 520, easing: Easing.bezier(0.4, 0, 0.2, 1) }, (done) => {
        if (done) runOnJS(commit)(value);
      });
    },
    [commit, fade, grow, height, isDark, system, width],
  );

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const value = useMemo(() => ({ colors, isDark, preference, setPreference }), [colors, isDark, preference, setPreference]);
  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {reveal ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veilStyle]}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: reveal.diameter,
                  height: reveal.diameter,
                  borderRadius: reveal.diameter / 2,
                  left: reveal.origin.x - reveal.diameter / 2,
                  top: reveal.origin.y - reveal.diameter / 2,
                  backgroundColor: reveal.color,
                },
                circleStyle,
              ]}
            />
          </Animated.View>
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme doit être utilisé sous <ThemeProvider>.');
  return theme;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  veil: { overflow: 'hidden', zIndex: 50 },
});
