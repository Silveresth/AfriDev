import { Tabs } from 'expo-router';
import { Home, type LucideIcon, MessagesSquare, Newspaper, UserRound, UsersRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/shared/i18n';
import { haptic, SPRING } from '@/shared/motion';
import { useTheme } from '@/shared/theme';

/** Icône d'onglet : à l'activation, petit saut et pastille teintée qui s'élargit dessous. */
function TabIcon({ icon: Icon, color, focused }: { icon: LucideIcon; color: string; focused: boolean }) {
  const { colors } = useTheme();
  const on = useSharedValue(focused ? 1 : 0);
  const bounce = useSharedValue(1);

  useEffect(() => {
    on.value = withSpring(focused ? 1 : 0, SPRING);
    if (focused) bounce.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 }));
  }, [bounce, focused, on]);

  const pill = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scaleX: 0.4 + on.value * 0.6 }] }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }, { translateY: -on.value * 1 }] }));

  return (
    <View style={styles.iconBox}>
      <Animated.View style={[styles.pill, { backgroundColor: colors.primarySoft }, pill]} />
      <Animated.View style={icon}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.9} />
      </Animated.View>
    </View>
  );
}

const tab = (title: string, icon: LucideIcon) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <TabIcon icon={icon} color={color} focused={focused} />,
});

/** Cinq onglets à portée du pouce ; « Créer » est le bouton rond des écrans de contenu. */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.select() }}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.iconSlot,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          // Onglet = 5 + icône 32 + libellé 15 + 5 : il faut au moins 57 pt de contenu.
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="feed" options={tab(t('nav.home'), Home)} />
      <Tabs.Screen name="news" options={tab(t('tab.news'), Newspaper)} />
      <Tabs.Screen name="questions" options={tab(t('tab.qa'), MessagesSquare)} />
      <Tabs.Screen name="hubs" options={tab(t('nav.hubs'), UsersRound)} />
      <Tabs.Screen name="profile" options={tab(t('nav.profile'), UserRound)} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  iconSlot: { width: 56, height: 32 },
  iconBox: { width: 56, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
});
