import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Copy, ExternalLink, KeyRound, LaptopMinimal, LogOut, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { errorMessage } from '@/shared/api';
import { t, tp } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { SkeletonList } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { mono, radius, useTheme } from '@/shared/theme';
import { Badge, Button, Header, Section, Text, useToast } from '@/shared/ui';

import { type DeviceSession, useSessionActions, useSessions, useTwoFactor } from './api';

function CodeField({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
      placeholder="123456"
      placeholderTextColor={colors.inkFaint}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={6}
      style={[styles.code, { color: colors.ink, borderColor: colors.lineStrong, backgroundColor: colors.surface }]}
      accessibilityLabel={t('sec.code')}
    />
  );
}

function TwoFactorSection() {
  const { colors } = useTheme();
  const { user } = useSession();
  const { setup, enable, disable } = useTwoFactor();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const enabled = Boolean(user?.two_factor_enabled);
  const pending = setup.data && !enabled;

  const confirm = async () => {
    try {
      if (enabled) {
        await disable.mutateAsync(code);
        toast(t('sec.disabled'));
        setDisabling(false);
      } else {
        await enable.mutateAsync(code);
        toast(t('sec.enabled'));
        setup.reset();
      }
      setCode('');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <Section
      index={0}
      icon={enabled ? ShieldCheck : KeyRound}
      title={t('sec.2fa')}
      description={t('sec.2fa_desc')}
      right={<Badge label={t(enabled ? 'sec.active' : 'sec.not_set')} tone={enabled ? 'success' : 'neutral'} />}
    >
      <Animated.View layout={LinearTransition.springify().damping(18)} style={styles.pad}>
        {enabled ? (
          disabling ? (
            <Animated.View entering={FadeInDown} style={[styles.box, { backgroundColor: colors.dangerSoft }]}>
              <Text variant="small" tone="danger">
                {t('sec.disable_prompt')}
              </Text>
              <CodeField value={code} onChange={setCode} />
              <View style={styles.actions}>
                <Button label={t('sec.disable')} icon={ShieldOff} variant="danger" size="sm" disabled={code.length !== 6} loading={disable.isPending} onPress={confirm} />
                <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setDisabling(false)} />
              </View>
            </Animated.View>
          ) : (
            <View style={styles.gap}>
              <Text variant="small" tone="muted">
                {t('sec.protected')}
              </Text>
              <Button label={t('sec.disable_2fa')} icon={ShieldOff} variant="secondary" size="sm" onPress={() => setDisabling(true)} />
            </View>
          )
        ) : pending ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.gap}>
            <Text variant="small" tone="muted">
              {t('sec.steps')}
            </Text>
            <View style={styles.qr}>
              <SvgXml xml={setup.data.qr_svg} width={180} height={180} />
            </View>
            <Button
              label={t('sec.open_app')}
              icon={ExternalLink}
              variant="secondary"
              size="sm"
              block
              onPress={() => void Linking.openURL(setup.data.otpauth_url).catch(() => toast(t('sec.no_app'), 'error'))}
            />
            <View style={[styles.secret, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <Text style={[styles.secretText, { color: colors.ink }]} selectable>
                {setup.data.secret.match(/.{1,4}/g)?.join(' ')}
              </Text>
              <Button
                label={t('sec.copy')}
                icon={Copy}
                variant="ghost"
                size="sm"
                onPress={async () => {
                  await Clipboard.setStringAsync(setup.data.secret);
                  toast(t('sec.key_copied'));
                }}
              />
            </View>
            <CodeField value={code} onChange={setCode} />
            <Button label={t('sec.enable_confirm')} block disabled={code.length !== 6} loading={enable.isPending} onPress={confirm} />
          </Animated.View>
        ) : (
          <View style={styles.gap}>
            <Text variant="small" tone="muted">
              {t('sec.why')}
            </Text>
            <Button label={t('sec.enable')} icon={ShieldCheck} size="sm" loading={setup.isPending} onPress={() => setup.mutate()} />
            {setup.isError ? (
              <Text variant="small" tone="danger">
                {errorMessage(setup.error)}
              </Text>
            ) : null}
          </View>
        )}
      </Animated.View>
    </Section>
  );
}

function SessionRow({ session, onRevoke, last }: { session: DeviceSession; onRevoke: () => void; last: boolean }) {
  const { colors } = useTheme();
  const mobile = /mobile|android|iphone|expo|okhttp/i.test(session.user_agent);
  const Icon = mobile ? Smartphone : LaptopMinimal;
  return (
    <View style={[styles.session, last ? null : { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.deviceIcon, { backgroundColor: colors.container }]}>
        <Icon size={18} color={colors.inkMuted} />
      </View>
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Text variant="smallStrong" numberOfLines={1} style={styles.shrink}>
            {session.device || session.user_agent || t('sec.unknown_device')}
          </Text>
          {session.current ? <Badge label={t('sec.this_device')} tone="success" /> : null}
        </View>
        <Text variant="caption" tone="faint" numberOfLines={2}>
          {session.ip_address || '—'} · {t('sec.active_ago', { when: timeAgo(session.last_used_at ?? session.created_at) })}
        </Text>
      </View>
      {session.current ? null : <Button label={t('sec.disconnect')} variant="ghost" size="sm" onPress={onRevoke} />}
    </View>
  );
}

function SessionsSection() {
  const sessions = useSessions();
  const { revoke, revokeOthers } = useSessionActions();
  const toast = useToast();
  const rows = sessions.data ?? [];
  const others = rows.filter((session) => !session.current).length;

  return (
    <Section
      index={1}
      icon={LaptopMinimal}
      title={t('sec.devices')}
      description={t('sec.devices_desc')}
    >
      {sessions.isPending ? (
        <SkeletonList variant="row" count={2} />
      ) : (
        <>
          {rows.map((session, index) => (
            <SessionRow
              key={session.id}
              session={session}
              last={index === rows.length - 1 && !others}
              onRevoke={() =>
                Alert.alert(t('sec.disconnect_title'), session.device || session.user_agent, [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('sec.disconnect'), style: 'destructive', onPress: () => revoke.mutate(session.id, { onSuccess: () => toast(t('sec.disconnected')) }) },
                ])
              }
            />
          ))}
          {others ? (
            <View style={styles.pad}>
              <Button
                label={t('sec.disconnect_others', { count: others })}
                icon={LogOut}
                variant="danger"
                size="sm"
                block
                loading={revokeOthers.isPending}
                onPress={() =>
                  revokeOthers.mutate(undefined, {
                    onSuccess: (result) => toast(tp('sec.others_done', result.revoked)),
                  })
                }
              />
            </View>
          ) : null}
        </>
      )}
    </Section>
  );
}

export function SecurityScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <Header title={t('set.security')} back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TwoFactorSection />
        <SessionsSection />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 48 },
  pad: { padding: 14 },
  gap: { gap: 12 },
  box: { gap: 12, padding: 12, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: 8 },
  code: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    textAlign: 'center',
    fontFamily: mono,
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: '700',
  },
  qr: { alignSelf: 'center', padding: 10, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  secret: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, paddingLeft: 12 },
  secretText: { flex: 1, fontFamily: mono, fontSize: 13, fontWeight: '700' },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  deviceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
