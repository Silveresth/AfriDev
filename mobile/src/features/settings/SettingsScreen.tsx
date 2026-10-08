import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Bell,
  ExternalLink,
  Gauge,
  HardDrive,
  Info,
  Languages,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { API_URL, PUBLIC_WEB_URL } from '@/shared/api';
import { type TextOnlyMode, useDataSaver } from '@/shared/data-saver';
import { type Key, LANGUAGES, useT } from '@/shared/i18n';
import { openLink, profileColorHex } from '@/shared/lib';
import { haptic, PressableScale } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, type ThemePreference, useTheme } from '@/shared/theme';
import { Avatar, Badge, Button, ForwardChevron, Header, Row, Section, Text, useToast } from '@/shared/ui';

const THEMES: { value: ThemePreference; label: Key; icon: typeof Sun }[] = [
  { value: 'light', label: 'settings.appearance.light', icon: Sun },
  { value: 'dark', label: 'settings.appearance.dark', icon: Moon },
  { value: 'system', label: 'set.system', icon: Monitor },
];

const TEXT_MODES: { value: TextOnlyMode; label: Key }[] = [
  { value: 'auto', label: 'settings.data.auto' },
  { value: 'on', label: 'settings.data.on' },
  { value: 'off', label: 'settings.data.off' },
];

const AFRICAN_COUNT = LANGUAGES.filter((lang) => lang.category === 'african').length;

/** Grandes tuiles du thème : l'écran se recolore en « encre » depuis la tuile touchée. */
function AppearanceTiles() {
  const { colors, preference, setPreference } = useTheme();
  const { t } = useT();
  return (
    <View style={styles.tiles}>
      {THEMES.map((theme) => {
        const active = preference === theme.value;
        return (
          <PressableScale
            key={theme.value}
            scaleTo={0.94}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={(event) => {
              haptic.select();
              setPreference(theme.value, { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
            }}
            style={[
              styles.tile,
              {
                borderColor: active ? colors.primary : colors.line,
                backgroundColor: active ? colors.primarySoft : colors.surface,
              },
            ]}
          >
            <theme.icon size={20} color={active ? colors.primaryInk : colors.inkMuted} />
            <Text variant="smallStrong" style={{ color: active ? colors.primaryInk : colors.inkMuted }}>
              {t(theme.label)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Sélecteur segmenté compact (mode texte seul). */
function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.container }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            scaleTo={0.94}
            onPress={() => {
              haptic.select();
              onChange(option.value);
            }}
            style={[styles.segment, active && { backgroundColor: colors.primary }]}
          >
            <Text variant="smallStrong" style={{ color: active ? colors.onPrimary : colors.inkMuted }}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function SettingsScreen() {
  const { colors } = useTheme();
  const { t, currentLang } = useT();
  const { user, profile, signOut } = useSession();
  const { mode, setMode, textOnly, cellular } = useDataSaver();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [clearing, setClearing] = useState(false);
  const name = profile?.display_name || user?.username || '';

  const clearCache = async () => {
    setClearing(true);
    await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]).catch(() => undefined);
    // Les données en mémoire sont rechargées à la demande (la session est conservée).
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    setClearing(false);
    toast(t('set.cleared'));
  };

  const confirmSignOut = () =>
    Alert.alert(t('set.logout_confirm'), t('set.logout_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: signOut },
    ]);

  const dataHint =
    mode === 'auto'
      ? `${t('set.data_auto')}${cellular ? ` ${t('set.data_cellular')}` : ''}`
      : t(mode === 'on' ? 'set.data_on' : 'set.data_off');

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <Header title={t('nav.settings')} back />
      <ScrollView contentContainerStyle={styles.content}>
        {user ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <PressableScale
              scaleTo={0.98}
              onPress={() => router.push('/profile')}
              style={[styles.profile, { borderColor: colors.line, backgroundColor: colors.background }]}
            >
              <Avatar name={name} src={profile?.avatar_url} size={52} color={profileColorHex(user.username, profile?.accent_color)} />
              <View style={styles.flex}>
                <Text variant="headline" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  @{user.username} · {user.email}
                </Text>
              </View>
              <ForwardChevron size={18} color={colors.inkFaint} />
            </PressableScale>
          </Animated.View>
        ) : null}

        <Section index={1}>
          <Row
            icon={ShieldCheck}
            label={t('set.security')}
            detail={t('set.security_desc')}
            right={
              <View style={styles.inline}>
                <Badge label={t(user?.two_factor_enabled ? 'set.2fa_on' : 'set.2fa_off')} tone={user?.two_factor_enabled ? 'success' : 'neutral'} />
                <ForwardChevron size={18} color={colors.inkFaint} />
              </View>
            }
            onPress={() => router.push('/settings/security')}
          />
          <Row icon={Bell} label={t('nav.notifications')} detail={t('set.notifications_desc')} onPress={() => router.push('/settings/notifications')} />
          <Row icon={Lock} label={t('set.privacy')} detail={t('set.privacy_desc')} onPress={() => router.push('/settings/privacy')} last />
        </Section>

        <Section index={2} title={t('settings.lang.title')} description={t('set.language_desc', { count: LANGUAGES.length, african: AFRICAN_COUNT })} icon={Languages}>
          <Row
            label={`${currentLang.flag}  ${currentLang.native}`}
            detail={currentLang.label}
            onPress={() => router.push('/settings/language')}
            last
          />
        </Section>

        <Section index={3} title={t('settings.appearance.title')} description={t('set.appearance_desc')} icon={Palette}>
          <View style={styles.pad}>
            <AppearanceTiles />
          </View>
        </Section>

        <Section
          index={4}
          title={t('set.data')}
          description={t('set.data_desc')}
          icon={Gauge}
          right={textOnly ? <Badge label={t('settings.data.active')} tone="success" /> : null}
        >
          <View style={[styles.pad, styles.gap]}>
            <Segmented options={TEXT_MODES.map((option) => ({ value: option.value, label: t(option.label) }))} value={mode} onChange={setMode} />
            <Text variant="small" tone="muted">
              {dataHint}
            </Text>
          </View>
        </Section>

        <Section index={5} title={t('set.storage')} description={t('set.storage_desc')} icon={HardDrive}>
          <View style={styles.pad}>
            <Button label={t('set.clear_cache')} variant="secondary" size="sm" block loading={clearing} onPress={clearCache} />
          </View>
        </Section>

        <Section index={6}>
          <Row icon={ExternalLink} label={t('set.open_web')} detail={PUBLIC_WEB_URL} onPress={() => void openLink(PUBLIC_WEB_URL)} />
          <Row icon={Info} label={`AfriDev Exchange ${Constants.expoConfig?.version ?? ''}`} detail={t('set.server', { url: API_URL })} last />
        </Section>

        <Section index={7}>
          <Row icon={LogOut} label={t('auth.logout')} danger onPress={confirmSignOut} last />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 48 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pad: { padding: 14 },
  gap: { gap: 12 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  segment: { flex: 1, height: 36, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
});
