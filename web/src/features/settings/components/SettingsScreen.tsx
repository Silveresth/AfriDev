'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Gauge,
  Globe,
  HardDrive,
  Languages,
  Layers,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Tv,
  User,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { api, unwrap } from '@/shared/api';
import { type TextOnlyMode, useDataSaver, type VideoQuality } from '@/shared/data-saver';
import { LANGUAGES, type LocaleCode, useLang } from '@/shared/i18n';
import { cn, formatBytes } from '@/shared/lib';
import { flushOutbox, removeFromOutbox, useOutbox, useStorageEstimate } from '@/shared/offline';
import { useSession } from '@/shared/session';
import { type ThemePreference, useTheme } from '@/shared/theme';
import { Avatar, Button, Card, StatusBadge, TimeAgo, useToast } from '@/shared/ui';

import { NotificationsTab } from './NotificationsTab';
import { PrivacyTab } from './PrivacyTab';
import { SecurityTab } from './SecurityTab';

type SettingsTab = 'general' | 'security' | 'notifications' | 'privacy';

export function SettingsScreen() {
  const { user, profile, isAuthenticated } = useSession();
  const [tab, setTab] = useState<SettingsTab>('general');
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* ── En-tête des Réglages ── */}
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-container px-2 py-0.5 text-xs font-semibold text-ink-muted mb-1.5">
            <Zap className="size-3 text-primary" />
            <span>{t('settings.badge')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{t('settings.title')}</h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Profil connecté résumé */}
        {isAuthenticated && user && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl border border-line bg-card p-2.5 transition-all hover:border-line-strong hover:bg-container-low shadow-xs"
          >
            <Avatar name={profile?.display_name || user.username} src={profile?.avatar_url} size={38} />
            <div className="min-w-0 pr-2">
              <span className="block truncate text-xs font-bold text-ink">
                {profile?.display_name || user.username}
              </span>
              <span className="block truncate text-[0.7rem] text-ink-faint">
                @{user.username}
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* ── Navigation par Onglets Modernes ── */}
      <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-line bg-container-low p-1.5 no-scrollbar">
        <TabButton
          active={tab === 'general'}
          onClick={() => setTab('general')}
          icon={<Gauge className="size-4" />}
          label={t('settings.tab.general')}
        />
        {isAuthenticated && (
          <>
            <TabButton
              active={tab === 'security'}
              onClick={() => setTab('security')}
              icon={<ShieldCheck className="size-4" />}
              label={t('settings.tab.security')}
            />
            <TabButton
              active={tab === 'notifications'}
              onClick={() => setTab('notifications')}
              icon={<Bell className="size-4" />}
              label={t('settings.tab.notifications')}
            />
            <TabButton
              active={tab === 'privacy'}
              onClick={() => setTab('privacy')}
              icon={<Lock className="size-4" />}
              label={t('settings.tab.privacy')}
            />
          </>
        )}
      </div>

      {/* ── Contenu des Onglets ── */}
      {tab === 'security' && <SecurityTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'privacy' && <PrivacyTab />}

      {tab === 'general' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* Colonne Principale */}
          <div className="space-y-6 min-w-0">
            <DataCard />
            <OutboxCard />
            <LanguageCard />
          </div>

          {/* Colonne Latérale */}
          <div className="space-y-6">
            <AppearanceCard />
            <StorageCard />
            <AccountCard />
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-all select-none cursor-pointer',
        active
          ? 'bg-card text-ink shadow-xs border border-line'
          : 'text-ink-muted hover:text-ink hover:bg-container/60',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Économie de Bande Passante & Données
 * ───────────────────────────────────────────────────────────── */
function DataCard() {
  const { mode, setMode, videoQuality, setVideoQuality, network, textOnly } = useDataSaver();
  const { t } = useLang();

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="border-b border-line bg-container-low/40 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
            <Gauge className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">{t('settings.data.title')}</h2>
            <p className="text-xs text-ink-muted">{t('settings.data.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Mode Texte Seul */}
        <div className="rounded-xl border border-line bg-container-low/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">{t('settings.data.text_only')}</span>
              {textOnly ? <StatusBadge tone="success">{t('settings.data.active')}</StatusBadge> : null}
            </div>

            <div className="flex rounded-lg border border-line bg-card p-0.5">
              {(['auto', 'on', 'off'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-all select-none',
                    mode === m ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {m === 'auto' ? t('settings.data.auto') : m === 'on' ? t('settings.data.on') : t('settings.data.off')}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            {t('settings.data.text_only.desc')}
            {network === 'slow' ? ` ${t('settings.data.text_only.slow')}` : '.'}
          </p>
        </div>

        {/* Qualité Vidéo */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">{t('settings.data.video_quality')}</span>
            <span className="text-[0.7rem] text-ink-faint">{t('settings.data.video_hint')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['auto', t('settings.data.auto'), t('settings.data.adaptive')],
                ['240', '240p', '~2 Mo / min'],
                ['480', '480p', '~6 Mo / min'],
                ['720', '720p', '~14 Mo / min'],
              ] as Array<[VideoQuality, string, string]>
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                aria-pressed={videoQuality === value}
                onClick={() => setVideoQuality(value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all select-none cursor-pointer',
                  videoQuality === value
                    ? 'border-primary bg-primary-soft/40 ring-2 ring-primary/20 text-primary-ink font-bold'
                    : 'border-line bg-card text-ink hover:border-line-strong hover:bg-container-low',
                )}
              >
                <span className="block text-xs font-bold">{label}</span>
                <span className="block text-[0.68rem] text-ink-faint mt-0.5">{hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Synchronisation Hors-ligne & Envois en attente
 * ───────────────────────────────────────────────────────────── */
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
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-line bg-container-low/40 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
            <Send className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">{t('settings.outbox.title')}</h2>
            <p className="text-xs text-ink-muted">{t('settings.outbox.subtitle')}</p>
          </div>
        </div>

        {pending.length > 0 && (
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
            <RefreshCw className="size-3.5 mr-1" /> {t('settings.outbox.sync')}
          </Button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {!pending.length && !failed.length && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-container-low/40 p-4 text-xs text-ink-muted">
            <ShieldCheck className="size-4 text-secondary shrink-0" />
            <span>{t('settings.outbox.empty')}</span>
          </div>
        )}

        {pending.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-2 rounded-xl border border-line bg-container-low/60 p-3.5">
            <div className="flex items-center justify-between">
              <StatusBadge tone="offline">
                <Clock className="size-3 mr-1" /> {t('settings.outbox.pending')}
              </StatusBadge>
              <TimeAgo date={entry.createdAt} className="text-[0.68rem] text-ink-faint" />
            </div>
            <p className="text-xs font-bold text-ink">{entry.label}</p>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-danger hover:bg-danger-soft"
                onClick={() => window.confirm(t('settings.outbox.abandon')) && removeFromOutbox(entry.id)}
              >
                <Trash2 className="size-3.5 mr-1" /> {t('settings.outbox.delete')}
              </Button>
            </div>
          </div>
        ))}

        {failed.map((rejection) => (
          <div key={rejection.id} className="space-y-2 rounded-xl border border-danger/30 bg-danger-soft/40 p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <StatusBadge tone="danger">
                <AlertTriangle className="size-3 mr-1" /> {t('settings.outbox.rejected')}
              </StatusBadge>
              <TimeAgo date={rejection.created_at} className="text-[0.68rem] text-ink-faint" />
            </div>
            <p className="font-bold text-ink">
              {{ posts: 'Post', comments: 'Commentaire', questions: 'Question', answers: 'Réponse', snippets: 'Snippet', projects: 'Projet', profiles: 'Profil' }[rejection.table] ?? rejection.table}
            </p>
            <p className="text-on-danger-soft">{rejection.message}</p>
            <Button size="sm" variant="ghost" onClick={() => acknowledge.mutate([rejection.id])}>
              {t('settings.outbox.understood')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Langues & Traductions Africaines & Internationales
 * ───────────────────────────────────────────────────────────── */
function LanguageCard() {
  const { locale, setLocale, currentLang, t } = useLang();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'african' | 'international'>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Filtrage intelligent (par nom natif, français, code ou pays)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LANGUAGES.filter((l) => {
      if (filter !== 'all' && l.category !== filter) return false;
      if (!q) return true;
      return (
        l.native.toLowerCase().includes(q) ||
        l.label.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.countries.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [search, filter]);

  // Langues complètes en accès direct
  const featured = useMemo(() => LANGUAGES.filter((l) => l.complete), []);

  const handleSelect = (code: LocaleCode) => {
    setLocale(code);
    const target = LANGUAGES.find((l) => l.code === code);
    if (target) {
      toast(`${t('settings.lang.activated')} : ${target.flag} ${target.native} (${target.label})`);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="border-b border-line bg-container-low/40 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
              <Languages className="size-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink">{t('settings.lang.title')}</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-bold text-primary">
                  {LANGUAGES.length}
                </span>
              </div>
              <p className="text-xs text-ink-muted">{t('settings.lang.subtitle')}</p>
            </div>
          </div>

          {/* Langue actuellement active */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-1.5 self-start sm:self-auto shadow-2xs">
            <span className="text-lg">{currentLang.flag}</span>
            <div className="text-left">
              <span className="block text-xs font-bold text-ink leading-tight">{currentLang.native}</span>
              <span className="block text-[0.65rem] text-ink-faint leading-tight">{currentLang.label}</span>
            </div>
            <span className="ml-1 inline-block size-2 rounded-full bg-emerald-500" title={t('settings.lang.active_badge')} />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Grille des langues principales avec traduction intégrale */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-ink">{t('settings.lang.instant')}</span>
            <span className="text-[0.68rem] text-ink-faint">{t('settings.lang.offline_ready')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {featured.map((l) => {
              const active = locale === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelect(l.code)}
                  className={cn(
                    'group flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all select-none cursor-pointer',
                    active
                      ? 'border-primary bg-primary-soft/40 ring-2 ring-primary/20 text-primary-ink font-bold shadow-xs'
                      : 'border-line bg-container-low/40 text-ink hover:border-line-strong hover:bg-container-low',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-base">{l.flag}</span>
                    {active ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="size-2.5" />
                      </span>
                    ) : (
                      <span className="text-[0.6rem] text-ink-faint uppercase font-mono">{l.code}</span>
                    )}
                  </div>
                  <span className="block truncate text-xs font-bold w-full">{l.native}</span>
                  <span className="block truncate text-[0.68rem] text-ink-muted w-full">{l.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section extensible pour toutes les langues africaines par pays */}
        <div className="rounded-xl border border-line bg-container-low/40 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5 text-primary" />
                <span className="text-xs font-bold text-ink">{t('settings.lang.all_african')}</span>
              </div>
              <p className="text-[0.7rem] text-ink-muted">
                {t('settings.lang.all_african_desc')}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs self-start sm:self-auto cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3.5 mr-1" /> {t('settings.lang.hide_catalog')}
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5 mr-1" /> {t('settings.lang.explore_catalog')} ({LANGUAGES.length})
                </>
              )}
            </Button>
          </div>

          {isExpanded && (
            <div className="pt-2 space-y-3 border-t border-line/60">
              {/* Barre de recherche et filtres de catégorie */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('settings.lang.search')}
                    className="w-full rounded-lg border border-line bg-card pl-8.5 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex rounded-lg border border-line bg-card p-0.5 shrink-0">
                  {(
                    [
                      ['all', t('settings.lang.all_tab')],
                      ['african', t('settings.lang.african')],
                      ['international', t('settings.lang.international')],
                    ] as const
                  ).map(([cat, label]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilter(cat)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-all select-none cursor-pointer',
                        filter === cat
                          ? 'bg-primary text-on-primary font-bold shadow-xs'
                          : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste défilable des langues */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {filtered.map((l) => {
                  const active = locale === l.code;
                  return (
                    <div
                      key={l.code}
                      onClick={() => handleSelect(l.code)}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-2 text-xs transition-all cursor-pointer',
                        active
                          ? 'border-primary bg-primary-soft/50 font-bold'
                          : 'border-line bg-card hover:border-line-strong hover:bg-container-low',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{l.flag}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink truncate">{l.native}</span>
                            <span className="text-[0.7rem] text-ink-faint">({l.label})</span>
                            {l.complete ? (
                              <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[0.6rem] font-bold text-emerald-600">
                                100%
                              </span>
                            ) : null}
                          </div>
                          <span className="block text-[0.68rem] text-ink-muted truncate">
                            {l.countries.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {active ? (
                          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <p className="py-4 text-center text-xs text-ink-muted">
                    {search}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          {t('settings.lang.translate_hint')}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Apparence (Thème Clair / Sombre / Système)
 * ───────────────────────────────────────────────────────────── */
function AppearanceCard() {
  const [theme, setTheme] = useTheme();
  const { t } = useLang();

  const options: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: t('settings.appearance.light'), icon: Sun },
    { value: 'dark', label: t('settings.appearance.dark'), icon: Moon },
    { value: 'system', label: t('settings.appearance.system'), icon: Monitor },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="border-b border-line bg-container-low/40 p-4">
        <h3 className="text-xs font-bold text-ink flex items-center gap-2">
          <Palette className="size-4 text-primary" /> {t('settings.appearance.title')}
        </h3>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={theme === option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all select-none cursor-pointer',
                theme === option.value
                  ? 'border-primary bg-primary-soft/50 text-primary-ink shadow-xs ring-1 ring-primary/20'
                  : 'border-line bg-container-low text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <option.icon className="size-4" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Stockage Local & Cache PWA
 * ───────────────────────────────────────────────────────────── */
function StorageCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useLang();
  const [version, setVersion] = useState(0);
  const storage = useStorageEstimate(version);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="border-b border-line bg-container-low/40 p-4">
        <h3 className="text-xs font-bold text-ink flex items-center gap-2">
          <HardDrive className="size-4 text-zinc-400" /> {t('settings.storage.title')}
        </h3>
      </div>

      <div className="p-4 space-y-3">
        {storage && (
          <div className="space-y-1.5 rounded-xl border border-line bg-container-low/50 p-3 text-xs">
            <div className="flex justify-between font-medium">
              <span className="text-ink-muted">{t('settings.storage.used')}</span>
              <span className="font-bold text-ink">{formatBytes(storage.usage)}</span>
            </div>
            <p className="text-[0.7rem] text-ink-faint">
              {formatBytes(Math.max(0, storage.quota - storage.usage))} {t('settings.storage.free')}
            </p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs font-semibold"
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
          <RefreshCw className="size-3.5 mr-1" /> {t('settings.storage.clear')}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Déconnexion / Session
 * ───────────────────────────────────────────────────────────── */
function AccountCard() {
  const { isAuthenticated, signOut } = useSession();
  const { t } = useLang();
  const router = useRouter();

  if (!isAuthenticated) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs p-4">
      <Button
        variant="ghost"
        className="w-full text-xs font-bold text-danger hover:bg-danger-soft"
        onClick={() => {
          signOut();
          router.replace('/');
        }}
      >
        <LogOut className="size-4 mr-1.5" /> {t('settings.account.logout')}
      </Button>
    </div>
  );
}
