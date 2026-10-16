'use client';

import { BellOff, BellRing, Mail, MonitorSmartphone, Smartphone } from 'lucide-react';

import { errorMessage, type Schemas } from '@/shared/api';
import { useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { useWebPush, type WebPushStatus } from '@/shared/push';
import { Button, Card, CardHeader, Skeleton, StatusBadge, Switch, ToggleRow, useToast } from '@/shared/ui';

import { useNotificationPreferences, useUpdateNotificationPreferences } from '../api';

/** Notifications : ce navigateur (Web Push), canaux communs à tous les appareils, types d'événements. */
export function NotificationsTab() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const toast = useToast();
  const { t } = useLang();

  const save = (changes: Schemas['PatchedPreferencesUpdateRequest']) =>
    update.mutate(changes, {
      onError: (error) => toast(errorMessage(error), 'error'),
      onSuccess: () => toast(t('settings.notif.saved')),
    });

  if (prefs.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (!prefs.data) return null;

  const muted = new Set(prefs.data.muted_kinds);

  return (
    <>
      <BrowserPushCard paused={!prefs.data.push_enabled} />

      <Card className="space-y-4 p-5">
        <CardHeader icon={<BellRing className="size-4" />} title={t('settings.notif.channels')} subtitle={t('settings.notif.channels_desc')} />
        <div className="space-y-2.5">
          <ToggleRow
            icon={<Smartphone />}
            title={t('settings.notif.push')}
            description={t('settings.notif.push_desc')}
            checked={prefs.data.push_enabled}
            onChange={(push_enabled) => save({ push_enabled })}
          />
          <ToggleRow
            icon={<Mail />}
            title={t('settings.notif.email')}
            description={t('settings.notif.email_desc')}
            checked={prefs.data.email_enabled}
            onChange={(email_enabled) => save({ email_enabled })}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <CardHeader title={t('settings.notif.events')} subtitle={t('settings.notif.events_desc')} />
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {prefs.data.kinds.map((kind) => {
            const active = !muted.has(kind.value);
            return (
              <li key={kind.value} className="flex items-center justify-between gap-4 py-1 pr-1.5 pl-4">
                <span className={cn('text-body-sm', active ? 'text-ink' : 'text-ink-faint')}>{kind.label}</span>
                <Switch
                  checked={active}
                  label={kind.label}
                  onChange={(on) => {
                    const next = new Set(muted);
                    if (on) next.delete(kind.value);
                    else next.add(kind.value);
                    save({ muted_kinds: [...next] as Schemas['NotificationKindEnum'][] });
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

const HINTS: Partial<Record<WebPushStatus, 'settings.push.denied' | 'settings.push.unsupported' | 'settings.push.ios' | 'settings.push.unavailable'>> = {
  denied: 'settings.push.denied',
  unsupported: 'settings.push.unsupported',
  'ios-install': 'settings.push.ios',
  unavailable: 'settings.push.unavailable',
};

/** Push sur ce navigateur : autorisation, abonnement et explication quand c'est impossible. */
function BrowserPushCard({ paused }: { paused: boolean }) {
  const { status, busy, enable, disable } = useWebPush();
  const { t } = useLang();
  const toast = useToast();
  const hint = HINTS[status];
  const ready = status === 'on' || status === 'off';

  return (
    <Card className={cn('space-y-4 p-5', status === 'on' && 'border-secondary/30')}>
      <CardHeader
        icon={status === 'on' ? <BellRing className="size-4 text-secondary" /> : <MonitorSmartphone className="size-4" />}
        title={t('settings.push.title')}
        subtitle={t('settings.push.desc')}
        action={
          status === 'loading' ? (
            <Skeleton className="h-8 w-24 rounded-lg" />
          ) : ready ? (
            <Button
              size="sm"
              variant={status === 'on' ? 'outline' : 'primary'}
              loading={busy}
              onClick={async () => {
                if (status === 'on') {
                  await disable();
                  toast(t('settings.push.disabled_toast'));
                } else {
                  await enable();
                  if (Notification.permission === 'granted') toast(t('settings.push.enabled_toast'));
                }
              }}
            >
              {status === 'on' ? <BellOff className="size-4" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
              {t(status === 'on' ? 'settings.push.disable' : 'settings.push.enable')}
            </Button>
          ) : null
        }
      />
      {ready ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status === 'on' ? 'success' : 'neutral'}>{t(status === 'on' ? 'settings.push.on' : 'settings.push.off')}</StatusBadge>
          {status === 'on' && paused ? <p className="text-body-sm text-ink-muted">{t('settings.push.paused')}</p> : null}
        </div>
      ) : null}
      {hint ? (
        <p className={cn('rounded-xl border px-3.5 py-3 text-body-sm', status === 'denied' ? 'border-tertiary/30 bg-tertiary-soft/60 text-on-tertiary-soft' : 'border-line bg-container-low text-ink-muted')}>
          {t(hint)}
        </p>
      ) : null}
    </Card>
  );
}
