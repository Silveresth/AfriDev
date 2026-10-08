import * as Clipboard from 'expo-clipboard';
import { AlertTriangle, Copy, Download, FileJson, KeyRound, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { errorMessage } from '@/shared/api';
import { t } from '@/shared/i18n';
import { longDate, timeAgo } from '@/shared/lib';
import { haptic, PressableScale, SkeletonList } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { mono, radius, useTheme } from '@/shared/theme';
import { Badge, Button, Header, Row, Section, Switch, Text, TextField, useToast } from '@/shared/ui';

import { exportMyData, useAccessTokenActions, useAccessTokens } from './api';

const EXPIRIES: { value: number | null; label: () => string }[] = [
  { value: 30, label: () => t('priv.days', { count: 30 }) },
  { value: 90, label: () => t('priv.days', { count: 90 }) },
  { value: 365, label: () => t('priv.year') },
  { value: null, label: () => t('priv.never') },
];

function TokensSection() {
  const { colors } = useTheme();
  const tokens = useAccessTokens();
  const { create, revoke } = useAccessTokenActions();
  const toast = useToast();
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [expires, setExpires] = useState<number | null>(90);
  const [created, setCreated] = useState<string | null>(null);

  const submit = async () => {
    try {
      const token = await create.mutateAsync({ name: name.trim(), read_only: readOnly, expires_in_days: expires });
      setCreated(token.token);
      setName('');
      toast(t('priv.created'));
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <Section index={0} icon={KeyRound} title={t('priv.tokens')} description={t('priv.tokens_desc')}>
      <Animated.View layout={LinearTransition.springify().damping(18)} style={[styles.pad, styles.gap]}>
        {created ? (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={[styles.created, { backgroundColor: colors.tertiarySoft }]}>
            <View style={styles.inline}>
              <AlertTriangle size={16} color={colors.tertiary} />
              <Text variant="smallStrong" style={[styles.flex, { color: colors.tertiary }]}>
                {t('priv.copy_now')}
              </Text>
            </View>
            <Text selectable style={[styles.token, { color: colors.ink, backgroundColor: colors.background, borderColor: colors.line }]}>
              {created}
            </Text>
            <View style={styles.inline}>
              <Button
                label={t('sec.copy')}
                icon={Copy}
                size="sm"
                onPress={async () => {
                  await Clipboard.setStringAsync(created);
                  toast(t('priv.copied'));
                }}
              />
              <Button label={t('priv.noted')} variant="ghost" size="sm" onPress={() => setCreated(null)} />
            </View>
          </Animated.View>
        ) : null}

        <TextField label={t('priv.name')} value={name} onChangeText={setName} placeholder={t('priv.name_ph')} maxLength={60} />
        <View style={styles.gapSm}>
          <Text variant="smallStrong">{t('priv.expiry')}</Text>
          <View style={[styles.segmented, { backgroundColor: colors.container }]}>
            {EXPIRIES.map((option) => {
              const active = option.value === expires;
              return (
                <PressableScale
                  key={String(option.value)}
                  scaleTo={0.94}
                  onPress={() => {
                    haptic.select();
                    setExpires(option.value);
                  }}
                  style={[styles.segment, active && { backgroundColor: colors.primary }]}
                >
                  <Text variant="smallStrong" style={{ color: active ? colors.onPrimary : colors.inkMuted }}>
                    {option.label()}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
        <View style={[styles.readOnly, { borderColor: colors.line }]}>
          <View style={styles.flex}>
            <Text variant="smallStrong">{t('priv.read_only')}</Text>
            <Text variant="caption" tone="muted">
              {t('priv.read_only_desc')}
            </Text>
          </View>
          <Switch label={t('priv.read_only')} value={readOnly} onChange={setReadOnly} />
        </View>
        <Button label={t('priv.generate')} icon={Plus} block disabled={!name.trim()} loading={create.isPending} onPress={submit} />
      </Animated.View>

      {tokens.isPending ? (
        <SkeletonList variant="row" count={1} />
      ) : (
        (tokens.data ?? []).map((token, index, rows) => (
          <Row
            key={token.id}
            label={token.name}
            last={index === rows.length - 1}
            detail={[
              `${token.prefix}…`,
              t('priv.created_ago', { when: timeAgo(token.created_at) }),
              token.last_used_at ? t('priv.used_ago', { when: timeAgo(token.last_used_at) }) : t('priv.never_used'),
              token.expires_at ? t('priv.expires', { date: longDate(token.expires_at) }) : t('priv.no_expiry'),
            ].join(' · ')}
            right={
              <View style={styles.inline}>
                <Badge label={t(token.read_only ? 'priv.read' : 'priv.write')} tone={token.read_only ? 'neutral' : 'warning'} />
                <PressableScale
                  scaleTo={0.85}
                  accessibilityLabel={`${t('priv.revoke')} ${token.name}`}
                  onPress={() =>
                    Alert.alert(t('priv.revoke_title', { name: token.name }), t('priv.revoke_body'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('priv.revoke'), style: 'destructive', onPress: () => revoke.mutate(token.id, { onSuccess: () => toast(t('priv.revoked')) }) },
                    ])
                  }
                  style={styles.trash}
                >
                  <Trash2 size={18} color={colors.danger} />
                </PressableScale>
              </View>
            }
          />
        ))
      )}
    </Section>
  );
}

function ExportSection() {
  const { profile } = useSession();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <Section index={1} icon={FileJson} title={t('priv.export')} description={t('priv.export_desc')}>
      <View style={[styles.pad, styles.gap]}>
        <Text variant="small" tone="muted">
          {t('priv.export_body')}
        </Text>
        <Button
          label={t('priv.download')}
          icon={Download}
          variant="secondary"
          block
          loading={loading}
          onPress={async () => {
            setLoading(true);
            try {
              await exportMyData(profile?.username ?? 'moi');
            } catch (error) {
              toast(errorMessage(error), 'error');
            } finally {
              setLoading(false);
            }
          }}
        />
      </View>
    </Section>
  );
}

export function PrivacyScreen() {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.surface }]}>
      <Header title={t('set.privacy')} back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TokensSection />
        <ExportSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 48 },
  pad: { padding: 14 },
  gap: { gap: 14 },
  gapSm: { gap: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  created: { gap: 10, padding: 12, borderRadius: radius.md },
  token: { fontFamily: mono, fontSize: 12, padding: 10, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth * 2 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  segment: { flex: 1, height: 36, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  trash: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
