'use client';

import { BellRing, Mail, MessageSquare, Smartphone } from 'lucide-react';

import { errorMessage, type Schemas } from '@/shared/api';
import { Skeleton, Switch, useToast } from '@/shared/ui';

import { useNotificationPreferences, useUpdateNotificationPreferences } from '../api';

export function NotificationsTab() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const toast = useToast();

  const save = (changes: Parameters<typeof update.mutate>[0]) =>
    update.mutate(changes, {
      onError: (error) => toast(errorMessage(error), 'error'),
      onSuccess: () => toast('Préférences enregistrées.'),
    });

  if (prefs.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (!prefs.data) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center text-xs text-ink-muted">
        Connectez-vous pour configurer vos alertes de notifications.
      </div>
    );
  }

  const muted = new Set(prefs.data.muted_kinds);

  return (
    <div className="space-y-6">
      {/* ── Canaux de Réception ── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
        <div className="border-b border-line bg-container-low/40 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
              <BellRing className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">Canaux de notification</h2>
              <p className="text-xs text-ink-muted">Définissez comment et où vous souhaitez être alerté</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <ChannelRow
            icon={<Smartphone className="size-4 text-primary" />}
            title="Notifications Push"
            text="Alertes directes sur votre appareil mobile ou navigateur web"
            checked={prefs.data.push_enabled}
            onChange={(push_enabled) => save({ push_enabled })}
          />

          <ChannelRow
            icon={<Mail className="size-4 text-secondary" />}
            title="E-mails récapitulatifs"
            text="Réservé aux alertes majeures (réponse acceptée, mentions, alertes sécurité)"
            checked={prefs.data.email_enabled}
            onChange={(email_enabled) => save({ email_enabled })}
          />
        </div>
      </div>

      {/* ── Types d'événements ── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
        <div className="border-b border-line bg-container-low/40 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
              <MessageSquare className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">Événements & Activités</h2>
              <p className="text-xs text-ink-muted">Sélectionnez les interactions qui déclenchent une notification</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
            {prefs.data.kinds.map((kind) => {
              const active = !muted.has(kind.value);
              return (
                <div key={kind.value} className="flex items-center justify-between gap-4 bg-card p-3.5 hover:bg-container-low/40 transition-colors">
                  <span className="text-xs font-semibold text-ink">{kind.label}</span>
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({
  icon,
  title,
  text,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-container-low/40 p-4 transition-colors hover:bg-container-low/70">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-card border border-line shadow-xs">
          {icon}
        </span>
        <div>
          <span className="block text-xs font-bold text-ink">{title}</span>
          <span className="block text-[0.72rem] text-ink-muted mt-0.5">{text}</span>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
