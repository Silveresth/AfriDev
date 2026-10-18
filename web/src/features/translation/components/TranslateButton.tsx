'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation } from '@tanstack/react-query';
import { Languages, Lightbulb } from 'lucide-react';
import { useState } from 'react';

import { api, ApiError, errorMessage, unwrap } from '@/shared/api';
import { COMPLETE_LOCALES, useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Markdown, pillAction, Spinner } from '@/shared/ui';

type Translation = Schemas['TranslationOutput'];
type Mode = 'translate' | 'simplify';

async function waitForTranslation(first: Translation): Promise<Translation> {
  let current = first;
  for (let attempt = 0; current.status === 'pending' && attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = await unwrap(
      api.GET('/api/translation/{translation_id}/', { params: { path: { translation_id: current.id } } }),
    );
  }
  if (current.status !== 'ready') throw new ApiError('Traduction indisponible pour le moment.', 'translation_failed', 0);
  return current;
}

type SupportedLang = Schemas['TargetLanguageEnum'];

/** Langue cible : celle de l'interface (16 langues traduites) ; sinon navigateur, puis français. */
export function translationTarget(locale: string): SupportedLang {
  const isSupported = (code: string): code is SupportedLang => (COMPLETE_LOCALES as readonly string[]).includes(code);
  if (isSupported(locale)) return locale;
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'fr';
}

/** Traduit (ou vulgarise) un texte ; résultat mis en cache côté serveur. */
export async function translateText(text: string, locale: string, mode: Mode = 'translate'): Promise<string> {
  const first = await unwrap(api.POST('/api/translation/', { body: { text, target_language: translationTarget(locale), mode } }));
  return (await waitForTranslation(first)).result ?? '';
}

/** « Traduire » / « Vulgariser » un contenu ; le résultat est mis en cache côté serveur. */
export function TranslateButton({ text, className, compact = false }: { text: string; className?: string; compact?: boolean }) {
  const { isAuthenticated } = useSession();
  const { t, locale } = useLang();
  const [result, setResult] = useState<{ mode: Mode; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async (mode: Mode) => ({ mode, text: await translateText(text, locale, mode) }),
    onSuccess: setResult,
  });

  if (!isAuthenticated) return null;
  // compact : icônes seules (pied des cartes du fil), le libellé reste au survol et pour les lecteurs d'écran.
  const action = cn(pillAction, compact && 'px-1.5 sm:px-2');
  const labelCls = compact ? 'sr-only' : 'hidden sm:inline';
  return (
    // display: contents : les boutons s'insèrent dans la barre d'actions du parent, la traduction
    // occupe ensuite toute la largeur (basis-full).
    <div className={cn('contents', className)}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => (result?.mode === 'translate' ? setResult(null) : mutation.mutate('translate'))}
          aria-label={t('feed.translate')}
          title={t('feed.translate')}
          className={action}
        >
          <Languages className="size-4" aria-hidden />
          <span className={labelCls}>{result?.mode === 'translate' ? t('feed.original') : t('feed.translate')}</span>
        </button>
        <button
          type="button"
          onClick={() => (result?.mode === 'simplify' ? setResult(null) : mutation.mutate('simplify'))}
          aria-label={t('feed.simplify')}
          title={t('feed.simplify')}
          className={action}
        >
          <Lightbulb className="size-4" aria-hidden />
          <span className={labelCls}>{result?.mode === 'simplify' ? t('feed.original') : t('feed.simplify')}</span>
        </button>
        {mutation.isPending ? <Spinner className="size-3.5 text-ink-faint" /> : null}
      </div>
      {mutation.isError ? <p className="basis-full text-body-sm text-danger">{errorMessage(mutation.error)}</p> : null}
      {result ? (
        <div className="mt-1 basis-full rounded-lg border border-tertiary/20 bg-tertiary-soft/60 p-3.5">
          <p className="mb-1 text-label-md font-semibold text-on-tertiary-soft">
            {result.mode === 'translate' ? t('feed.translation_ai') : t('feed.simplify_ai')}
          </p>
          <Markdown source={result.text} />
        </div>
      ) : null}
    </div>
  );
}
