import { BellRing, Mail, MessageSquare, Smartphone } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage, type Schemas } from '@/shared/api';
import { t } from '@/shared/i18n';
import { SkeletonList } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { ErrorState, Header, Row, Section, Switch, useToast } from '@/shared/ui';

import { useNotificationPreferences, useUpdateNotificationPreferences } from './api';

/** Canaux (push, e-mail) et types d'événements, comme l'onglet Notifications du web. */
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
          <Section index={0} icon={BellRing} title={t('nset.channels')} description={t('nset.channels_desc')}>
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

          <Section index={1} icon={MessageSquare} title={t('nset.events')} description={t('nset.events_desc')}>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 22, paddingBottom: 48 },
});
