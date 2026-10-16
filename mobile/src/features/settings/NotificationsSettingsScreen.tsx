import { useQuery } from '@tanstack/react-query';
import { BellRing, Mail, MessageSquare, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage, type Schemas } from '@/shared/api';
import { t } from '@/shared/i18n';
import { SkeletonList } from '@/shared/motion';
import { pushState, registerForPush } from '@/shared/push';
import { useTheme } from '@/shared/theme';
import { Badge, Button, ErrorState, Header, Row, Section, Switch, Text, useToast } from '@/shared/ui';

import { useNotificationPreferences, useUpdateNotificationPreferences } from './api';

/** Ce téléphone (autorisation système), canaux (push, e-mail) et types d'événements. */
export function NotificationsSettingsScreen() {
  const { colors } = useTheme();
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const toast = useToast();

  const save = (changes: Schemas['PatchedPreferencesUpdateRequest']) =>
    update.mutate(changes, { onError: (error) => toast(errorMessage(error), 'error') });

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <Header title={t('nav.notifications')} back />
      {prefs.isPending ? (
        <SkeletonList variant="row" count={5} />
      ) : !prefs.data ? (
        <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <DeviceSection paused={!prefs.data.push_enabled} />

          <Section index={1} icon={BellRing} title={t('nset.channels')} description={t('nset.channels_desc')}>
            <Row
              icon={Smartphone}
              label={t('nset.push')}
              detail={t('nset.push_desc')}
              right={<Switch label={t('nset.push')} value={prefs.data.push_enabled} onChange={(push_enabled) => save({ push_enabled })} />}
            />
            <Row
              icon={Mail}
              label={t('nset.email')}
              detail={t('nset.email_desc')}
              right={<Switch label={t('nset.email')} value={prefs.data.email_enabled} onChange={(email_enabled) => save({ email_enabled })} />}
              last
            />
          </Section>

          <Section index={2} icon={MessageSquare} title={t('nset.events')} description={t('nset.events_desc')}>
            {prefs.data.kinds.map((kind, index) => {
              const muted = new Set(prefs.data.muted_kinds);
              return (
                <Row
                  key={kind.value}
                  label={kind.label}
                  last={index === prefs.data.kinds.length - 1}
                  right={
                    <Switch
                      label={kind.label}
                      value={!muted.has(kind.value)}
                      onChange={(on) => {
                        const next = new Set(muted);
                        if (on) next.delete(kind.value);
                        else next.add(kind.value);
                        save({ muted_kinds: [...next] as Schemas['NotificationKindEnum'][] });
                      }}
                    />
                  }
                />
              );
            })}
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

/** Autorisation du système pour ce téléphone ; relue au retour des réglages du téléphone. */
function DeviceSection({ paused }: { paused: boolean }) {
  const state = useQuery({ queryKey: ['push', 'state'], queryFn: pushState, staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void state.refetch();
    });
    return () => subscription.remove();
  }, [state]);

  const status = state.data;
  const badge =
    status === 'granted'
      ? { label: t('nset.device_on'), tone: 'success' as const }
      : status === 'denied'
        ? { label: t('nset.device_denied'), tone: 'neutral' as const }
        : status === 'undetermined'
          ? { label: t('nset.device_off'), tone: 'neutral' as const }
          : null;

  return (
    <Section index={0} icon={Smartphone} title={t('nset.device')} description={t('nset.device_desc')} right={badge ? <Badge label={badge.label} tone={badge.tone} /> : null}>
      <View style={styles.device}>
        {status === 'unsupported' ? (
          <Text variant="small" tone="muted">
            {t('nset.device_unsupported')}
          </Text>
        ) : status === 'granted' ? (
          paused ? (
            <Text variant="small" tone="muted">
              {t('nset.paused')}
            </Text>
          ) : null
        ) : status === 'denied' ? (
          <Button label={t('nset.open_settings')} variant="secondary" size="sm" block onPress={() => void Linking.openSettings()} />
        ) : status === 'undetermined' ? (
          <Button
            label={t('nset.enable')}
            size="sm"
            block
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await registerForPush({ prompt: true });
              } catch (error) {
                toast(errorMessage(error), 'error');
              } finally {
                setBusy(false);
                void state.refetch();
              }
            }}
          />
        ) : null}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 48 },
  device: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
});
