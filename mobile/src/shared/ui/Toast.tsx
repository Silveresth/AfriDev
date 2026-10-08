import { CheckCircle2, CircleAlert } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';

import { Text } from './Text';

type Tone = 'success' | 'error';
interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

/** Petit message qui descend du haut de l'écran puis s'efface (confirmation, erreur). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    if (tone === 'error') haptic.error();
    else haptic.success();
    setToast({ id: Date.now(), message, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const Icon = toast?.tone === 'error' ? CircleAlert : CheckCircle2;
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={SlideInUp.springify().damping(16)}
          exiting={FadeOutUp.duration(200)}
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 8, backgroundColor: colors.ink }]}
        >
          <Icon size={18} color={toast.tone === 'error' ? colors.danger : colors.secondaryInk} />
          <Text variant="smallStrong" style={[styles.text, { color: colors.background }]} numberOfLines={3}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  text: { flex: 1 },
});
