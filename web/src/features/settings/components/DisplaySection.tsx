'use client';

import { Check, ChevronDown, ChevronUp, Languages, Monitor, Moon, Palette, Search, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';

import { LANGUAGES, type LocaleCode, useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { type ThemePreference, useTheme } from '@/shared/theme';
import { Card, CardHeader, Segmented, useToast } from '@/shared/ui';

/** Affichage : thème et langue de l'interface. */
export function DisplaySection() {
  return (
    <>
      <AppearanceCard />
      <LanguageCard />
    </>
  );
}

function AppearanceCard() {
  const [theme, setTheme] = useTheme();
  const { t } = useLang();
  const options: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: t('settings.appearance.light'), icon: Sun },
    { value: 'dark', label: t('settings.appearance.dark'), icon: Moon },
    { value: 'system', label: t('settings.appearance.system'), icon: Monitor },
  ];

  return (
    <Card className="space-y-4 p-5">
      <CardHeader icon={<Palette className="size-4" />} title={t('settings.appearance.title')} subtitle={t('settings.appearance.desc')} />
      <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label={t('settings.appearance.title')}>
        {options.map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-body-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary-soft/50 text-primary-ink ring-2 ring-primary/15'
                  : 'border-line bg-container-low/60 text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <option.icon className="size-5" aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function LanguageCard() {
  const { locale, setLocale, currentLang, t } = useLang();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'african' | 'international'>('all');
  const [expanded, setExpanded] = useState(false);
  const featured = useMemo(() => LANGUAGES.filter((lang) => lang.complete), []);

  // Recherche par nom natif, nom français, code ou pays.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LANGUAGES.filter((lang) => {
      if (filter !== 'all' && lang.category !== filter) return false;
      if (!q) return true;
      return (
        lang.native.toLowerCase().includes(q) ||
        lang.label.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.countries.some((country) => country.toLowerCase().includes(q))
      );
    });
  }, [search, filter]);

  const select = (code: LocaleCode) => {
    setLocale(code);
    const target = LANGUAGES.find((lang) => lang.code === code);
    if (target) toast(`${t('settings.lang.activated')} : ${target.flag} ${target.native}`);
  };

  return (
    <Card className="space-y-5 p-5">
      <CardHeader
        icon={<Languages className="size-4" />}
        title={t('settings.lang.title')}
        subtitle={t('settings.lang.subtitle')}
        action={
          <span className="flex items-center gap-2 rounded-lg border border-line bg-container-low px-2.5 py-1 text-body-sm font-medium text-ink">
            <span aria-hidden>{currentLang.flag}</span>
            {currentLang.native}
          </span>
        }
      />

      <div className="space-y-2.5">
        <p className="text-label-md font-medium text-ink-faint">{t('settings.lang.instant')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {featured.map((lang) => {
            const active = locale === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                aria-pressed={active}
                onClick={() => select(lang.code)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-primary bg-primary-soft/50 ring-2 ring-primary/15' : 'border-line hover:border-line-strong hover:bg-container-low',
                )}
              >
                <span className="text-lg" aria-hidden>
                  {lang.flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-body-sm font-semibold', active ? 'text-primary-ink' : 'text-ink')}>{lang.native}</span>
                  <span className="block truncate text-label-md text-ink-faint">{lang.label}</span>
                </span>
                {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-body-sm font-semibold text-ink">{t('settings.lang.all_african')}</span>
            <span className="block text-body-sm text-ink-muted">{t('settings.lang.all_african_desc')}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-body-sm text-ink-muted">
            {LANGUAGES.length}
            {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </span>
        </button>

        {expanded ? (
          <div className="space-y-3 border-t border-line p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                <span className="sr-only">{t('settings.lang.search')}</span>
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('settings.lang.search')}
                  className="h-9 w-full rounded-lg border border-line bg-card pr-3 pl-9 text-body-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
                />
              </label>
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('settings.lang.all_tab') },
                  { value: 'african', label: t('settings.lang.african') },
                  { value: 'international', label: t('settings.lang.international') },
                ]}
              />
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {filtered.map((lang) => {
                const active = locale === lang.code;
                return (
                  <li key={lang.code}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => select(lang.code)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        active ? 'bg-primary-soft/60' : 'hover:bg-container-low',
                      )}
                    >
                      <span className="text-base" aria-hidden>
                        {lang.flag}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-medium text-ink">
                          {lang.native} <span className="text-ink-faint">· {lang.label}</span>
                        </span>
                        <span className="block truncate text-label-md text-ink-faint">{lang.countries.join(', ')}</span>
                      </span>
                      {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? <li className="py-4 text-center text-body-sm text-ink-muted">—</li> : null}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="text-body-sm text-ink-muted">{t('settings.lang.translate_hint')}</p>
    </Card>
  );
}
