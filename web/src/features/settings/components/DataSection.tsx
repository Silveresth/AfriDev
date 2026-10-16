'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Gauge, HardDrive, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { api, unwrap } from '@/shared/api';
import { useDataSaver, type VideoQuality } from '@/shared/data-saver';
import { useLang } from '@/shared/i18n';
import { cn, formatBytes } from '@/shared/lib';
import { flushOutbox, removeFromOutbox, useOutbox, useStorageEstimate } from '@/shared/offline';
import { useSession } from '@/shared/session';
import { Button, Card, CardHeader, Segmented, StatusBadge, TimeAgo, useToast } from '@/shared/ui';

/** Données : économie de bande passante, envois hors ligne en attente et cache local. */
export function DataSection() {
  return (
    <>
      <DataSaverCard />
      <OutboxCard />
      <StorageCard />
    </>
  );
}

const TABLE_LABELS: Record<string, string> = {
  posts: 'Post',
  comments: 'Commentaire',
  questions: 'Question',
  answers: 'Réponse',
  snippets: 'Snippet',
  projects: 'Projet',
  profiles: 'Profil',
};

function DataSaverCard() {
  const { mode, setMode, videoQuality, setVideoQuality, network, textOnly } = useDataSaver();
  const { t } = useLang();
  const qualities: Array<[VideoQuality, string, string]> = [
    ['auto', t('settings.data.auto'), t('settings.data.adaptive')],
    ['240', '240p', '~2 Mo / min'],
    ['480', '480p', '~6 Mo / min'],
    ['720', '720p', '~14 Mo / min'],
  ];

  return (
    <Card className="space-y-5 p-5">
      <CardHeader
        icon={<Gauge className="size-4" />}
        title={t('settings.data.title')}
        subtitle={t('settings.data.subtitle')}
        action={textOnly ? <StatusBadge tone="success">{t('settings.data.active')}</StatusBadge> : null}
      />

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm font-semibold text-ink">{t('settings.data.text_only')}</p>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'auto', label: t('settings.data.auto') },
              { value: 'on', label: t('settings.data.on') },
              { value: 'off', label: t('settings.data.off') },
            ]}
          />
        </div>
        <p className="text-body-sm text-ink-muted">
          {t('settings.data.text_only.desc')}
          {network === 'slow' ? ` ${t('settings.data.text_only.slow')}` : '.'}
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-body-sm font-semibold text-ink">{t('settings.data.video_quality')}</p>
          <p className="text-label-md text-ink-faint">{t('settings.data.video_hint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t('settings.data.video_quality')}>
          {qualities.map(([value, label, hint]) => {
            const active = videoQuality === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setVideoQuality(value)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-primary bg-primary-soft/50 ring-2 ring-primary/15' : 'border-line hover:border-line-strong hover:bg-container-low',
                )}
              >
                <span className={cn('block text-body-sm font-semibold', active ? 'text-primary-ink' : 'text-ink')}>{label}</span>
                <span className="block text-label-md text-ink-faint">{hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function OutboxCard() {
  const pending = useOutbox();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAuthenticated } = useSession();
  const { t } = useLang();
  const [flushing, setFlushing] = useState(false);

  const rejections = useQuery({
    queryKey: ['sync', 'rejections'],
    queryFn: () => unwrap(api.GET('/api/sync/rejections/')),
    enabled: isAuthenticated,
  });
  const acknowledge = useMutation({
    mutationFn: (ids: string[]) => unwrap(api.POST('/api/sync/rejections/ack/', { body: { ids } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync', 'rejections'] }),
  });
  const failed = rejections.data ?? [];

  return (
    <Card className="space-y-4 p-5">
      <CardHeader
        icon={<Send className="size-4" />}
        title={t('settings.outbox.title')}
        subtitle={t('settings.outbox.subtitle')}
        action={
          pending.length > 0 ? (
            <Button
              size="sm"
              loading={flushing}
              onClick={async () => {
                setFlushing(true);
                await flushOutbox();
                setFlushing(false);
                toast(navigator.onLine ? t('settings.outbox.sync_online') : t('settings.outbox.sync_offline'), 'queued');
              }}
            >
              <RefreshCw className="size-4" aria-hidden /> {t('settings.outbox.sync')}
            </Button>
          ) : null
        }
      />

      {!pending.length && !failed.length ? (
        <p className="flex items-center gap-2.5 rounded-xl bg-container-low px-4 py-3 text-body-sm text-ink-muted">
          <CheckCircle2 className="size-4 shrink-0 text-secondary" aria-hidden />
          {t('settings.outbox.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <Clock className="size-4 shrink-0 text-ink-faint" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-ink">{entry.label}</p>
                <p className="text-label-md text-ink-faint">
                  {t('settings.outbox.pending')} · <TimeAgo date={entry.createdAt} />
                </p>
              </div>
              <Button
                size="sm"
                variant="plain"
                className="text-danger hover:bg-danger-soft"
                onClick={() => window.confirm(t('settings.outbox.abandon')) && removeFromOutbox(entry.id)}
              >
                <Trash2 className="size-4" aria-hidden /> {t('settings.outbox.delete')}
              </Button>
            </li>
          ))}
          {failed.map((rejection) => (
            <li key={rejection.id} className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft/40 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-medium text-ink">
                  {TABLE_LABELS[rejection.table] ?? rejection.table} · {t('settings.outbox.rejected')}
                </p>
                <p className="text-body-sm text-on-danger-soft">{rejection.message}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => acknowledge.mutate([rejection.id])}>
                {t('settings.outbox.understood')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StorageCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useLang();
  const [version, setVersion] = useState(0);
  const storage = useStorageEstimate(version);
  const share = storage && storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <Card className="space-y-4 p-5">
      <CardHeader
        icon={<HardDrive className="size-4" />}
        title={t('settings.storage.title')}
        subtitle={t('settings.storage.desc')}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              queryClient.clear();
              if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.filter((name) => !name.includes('precache')).map((name) => caches.delete(name)));
              }
              setVersion((v) => v + 1);
              toast(t('settings.storage.cleared'));
            }}
          >
            <RefreshCw className="size-4" aria-hidden /> {t('settings.storage.clear')}
          </Button>
        }
      />
      {storage ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-container" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share, 1)}%` }} />
          </div>
          <p className="text-body-sm text-ink-muted">
            <span className="font-semibold text-ink">{formatBytes(storage.usage)}</span> {t('settings.storage.used').toLowerCase()} ·{' '}
            {formatBytes(Math.max(0, storage.quota - storage.usage))} {t('settings.storage.free')}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
