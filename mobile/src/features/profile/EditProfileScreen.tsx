import { router } from 'expo-router';
import { BriefcaseBusiness, Check, GitBranch, Globe, MapPin, Plus, UserRound, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { errorMessage } from '@/shared/api';
import { PROFILE_COLORS, type ProfileColor, profileColor } from '@/shared/lib';
import { type Key, useT } from '@/shared/i18n';
import { haptic, PressableScale } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, Header, Loading, Switch, Text, TextField, useToast } from '@/shared/ui';

import { type MyProfile, useUpdateProfile, WORK_PREFERENCES, type WorkPreference } from './api';

const SUGGESTIONS = ['python', 'django', 'react', 'react-native', 'flutter', 'node', 'go', 'laravel'];

function Group({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)} style={styles.group}>
      <Text variant="caption" tone="muted" style={styles.groupTitle}>
        {title.toUpperCase()}
      </Text>
      {children}
    </Animated.View>
  );
}

/** Aperçu de la bannière : la couleur glisse vers la nouvelle teinte choisie. */
function BannerPreview({ color, name, avatar }: { color: string; name: string; avatar?: string }) {
  const { colors } = useTheme();
  const previous = useSharedValue(color);
  const next = useSharedValue(color);
  const progress = useSharedValue(1);
  useEffect(() => {
    previous.value = next.value;
    next.value = color;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 350 });
  }, [color, next, previous, progress]);
  const style = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], [previous.value, next.value]) }));
  return (
    <Animated.View style={[styles.banner, style]}>
      <View style={[styles.bannerAvatar, { backgroundColor: colors.background }]}>
        <Avatar name={name} src={avatar} color={color} size={44} />
      </View>
    </Animated.View>
  );
}

function StackInput({ value, onChange }: { value: string[]; onChange: (stack: string[]) => void }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const { t } = useT();
  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || value.includes(tag) || value.length >= 20) return;
    haptic.select();
    onChange([...value, tag]);
  };
  return (
    <View style={styles.gap}>
      <Animated.View layout={LinearTransition.springify().damping(18)} style={styles.wrap}>
        {value.map((tag) => (
          <Animated.View key={tag} entering={ZoomIn.springify().damping(14)} exiting={ZoomOut.duration(120)}>
            <PressableScale
              scaleTo={0.92}
              accessibilityLabel={t('edit.remove', { tag })}
              onPress={() => onChange(value.filter((item) => item !== tag))}
              style={[styles.chip, { backgroundColor: colors.primarySoft }]}
            >
              <Text variant="smallStrong" tone="primary">
                {tag}
              </Text>
              <X size={13} color={colors.primaryInk} />
            </PressableScale>
          </Animated.View>
        ))}
      </Animated.View>
      <View style={[styles.stackInput, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            if (/[,\n]/.test(text)) {
              text.split(/[,\n]/).forEach(add);
              setDraft('');
            } else setDraft(text);
          }}
          onSubmitEditing={() => {
            add(draft);
            setDraft('');
          }}
          placeholder={t('edit.stack_ph')}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit={false}
          style={[typography.body, styles.flex, { color: colors.ink }]}
        />
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel={t('edit.add')}
          onPress={() => {
            add(draft);
            setDraft('');
          }}
          style={[styles.addBtn, { backgroundColor: draft.trim() ? colors.primary : colors.container }]}
        >
          <Plus size={16} color={draft.trim() ? colors.onPrimary : colors.inkFaint} />
        </PressableScale>
      </View>
      <View style={styles.wrap}>
        {SUGGESTIONS.filter((tag) => !value.includes(tag)).map((tag) => (
          <PressableScale key={tag} scaleTo={0.92} onPress={() => add(tag)} style={[styles.suggestion, { borderColor: colors.line }]}>
            <Text variant="caption" tone="muted">
              + {tag}
            </Text>
          </PressableScale>
        ))}
      </View>
      <Text variant="caption" tone="faint">
        {t('edit.stack_hint', { count: value.length })}
      </Text>
    </View>
  );
}

function EditForm({ profile }: { profile: MyProfile }) {
  const { colors } = useTheme();
  const update = useUpdateProfile();
  const toast = useToast();
  const { t } = useT();
  const [form, setForm] = useState({
    display_name: profile.display_name,
    bio: profile.bio,
    location: profile.location,
    website: profile.website,
    github_username: profile.github_username,
    stack: profile.stack,
    open_to_work: profile.open_to_work,
    work_preferences: profile.work_preferences as WorkPreference[],
    daily_rate: profile.daily_rate,
    availability_note: profile.availability_note,
    accent_color: profileColor(profile.username, profile.accent_color),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const accent = PROFILE_COLORS[form.accent_color].hex;

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast(t('edit.saved'));
      router.back();
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('edit.title')}
        close
        right={<Button label={t('common.save')} size="sm" loading={update.isPending} onPress={save} style={styles.save} />}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Group title={t('settings.appearance.title')} index={0}>
          <BannerPreview color={accent} name={form.display_name || profile.username} avatar={profile.avatar_url} />
          <Text variant="smallStrong">
            {t('edit.color')} <Text tone="muted">· {t(`color.${form.accent_color}` as Key)}</Text>
          </Text>
          <View style={styles.colors}>
            {(Object.keys(PROFILE_COLORS) as ProfileColor[]).map((key) => {
              const active = form.accent_color === key;
              return (
                <PressableScale
                  key={key}
                  scaleTo={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`color.${key}` as Key)}
                  onPress={() => {
                    haptic.select();
                    set('accent_color', key);
                  }}
                  style={[styles.swatchRing, { borderColor: active ? colors.ink : 'transparent' }]}
                >
                  <View style={[styles.swatch, { backgroundColor: PROFILE_COLORS[key].hex }]}>
                    {active ? (
                      <Animated.View entering={ZoomIn.springify().damping(10)}>
                        <Check size={15} color="#FFFFFF" />
                      </Animated.View>
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </Group>

        <Group title={t('edit.identity')} index={1}>
          <TextField label={t('edit.display_name')} icon={UserRound} value={form.display_name} onChangeText={(v) => set('display_name', v)} maxLength={80} />
          <TextField
            label={t('edit.bio')}
            value={form.bio}
            onChangeText={(v) => set('bio', v)}
            multiline
            maxLength={600}
            hint={t('edit.bio_hint', { count: form.bio.length })}
          />
          <TextField label={t('edit.location')} icon={MapPin} value={form.location} onChangeText={(v) => set('location', v)} placeholder="Lomé, Togo" maxLength={80} />
        </Group>

        <Group title={t('edit.links')} index={2}>
          <TextField
            label={t('edit.github')}
            icon={GitBranch}
            value={form.github_username}
            onChangeText={(v) => set('github_username', v.trim())}
            placeholder="octocat"
            autoCapitalize="none"
            maxLength={39}
            hint={t('edit.github_hint')}
          />
          <TextField
            label={t('edit.website')}
            icon={Globe}
            value={form.website}
            onChangeText={(v) => set('website', v.trim())}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
          />
        </Group>

        <Group title={t('profile.skills')} index={3}>
          <Text variant="smallStrong">{t('edit.stack')}</Text>
          <StackInput value={form.stack} onChange={(stack) => set('stack', stack)} />
        </Group>

        <Group title={t('edit.availability')} index={4}>
          <View style={[styles.toggle, { borderColor: colors.line }]}>
            <BriefcaseBusiness size={20} color={colors.secondaryInk} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('edit.otw')}</Text>
              <Text variant="caption" tone="muted">
                {t('edit.otw_desc')}
              </Text>
            </View>
            <Switch label={t('edit.otw')} value={form.open_to_work} onChange={(v) => set('open_to_work', v)} />
          </View>
          {form.open_to_work ? (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.gap}>
              <Text variant="smallStrong">{t('edit.looking')}</Text>
              <View style={styles.wrap}>
                {(Object.keys(WORK_PREFERENCES) as WorkPreference[]).map((code) => {
                  const active = form.work_preferences.includes(code);
                  return (
                    <PressableScale
                      key={code}
                      scaleTo={0.92}
                      onPress={() => {
                        haptic.select();
                        set(
                          'work_preferences',
                          active ? form.work_preferences.filter((v) => v !== code) : [...form.work_preferences, code],
                        );
                      }}
                      style={[
                        styles.pref,
                        active ? { backgroundColor: colors.secondary, borderColor: colors.secondary } : { borderColor: colors.line },
                      ]}
                    >
                      {active ? <Check size={13} color="#FFFFFF" /> : null}
                      <Text variant="smallStrong" style={{ color: active ? '#FFFFFF' : colors.inkMuted }}>
                        {t(WORK_PREFERENCES[code])}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
              <TextField
                label={t('edit.rate')}
                value={form.daily_rate}
                onChangeText={(v) => set('daily_rate', v)}
                placeholder={t('edit.rate_ph')}
                maxLength={40}
              />
              <TextField
                label={t('edit.availability')}
                value={form.availability_note}
                onChangeText={(v) => set('availability_note', v)}
                placeholder={t('edit.availability_ph')}
                maxLength={200}
              />
            </Animated.View>
          ) : null}
        </Group>

        {update.isError ? (
          <Text variant="small" tone="danger">
            {errorMessage(update.error)}
          </Text>
        ) : null}
        <Button label={t('edit.save')} block loading={update.isPending} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function EditProfileScreen() {
  const { profile } = useSession();
  return profile ? <EditForm profile={profile} /> : <Loading />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  save: { marginRight: 8 },
  content: { padding: 16, gap: 26, paddingBottom: 56 },
  group: { gap: 12 },
  groupTitle: { letterSpacing: 0.6 },
  gap: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  banner: { height: 84, borderRadius: radius.lg, justifyContent: 'flex-end', padding: 10 },
  bannerAvatar: { alignSelf: 'flex-start', padding: 3, borderRadius: 28 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchRing: { padding: 2, borderRadius: 20, borderWidth: 2 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill },
  stackInput: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingLeft: 14, paddingRight: 6, borderRadius: radius.md, borderWidth: 1.5 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  suggestion: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  pref: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5 },
});
