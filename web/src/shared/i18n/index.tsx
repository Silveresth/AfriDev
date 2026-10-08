'use client';

import React, { createContext, useContext, useEffect, useMemo } from 'react';

import { useLocalPreference } from '@/shared/hooks';

// Catalogue et dictionnaires partagés avec l'appli mobile (packages/i18n).
import {
  COMPLETE_LOCALES,
  FRENCH as fr,
  getFallbackLocale,
  LANG_MAP,
  LANGUAGES,
  type LangMeta,
  type LocaleCode,
  MESSAGES,
  type MessageKey,
} from '@afridev/i18n';

export { COMPLETE_LOCALES, LANG_MAP, LANGUAGES };
export type { LangMeta, LocaleCode, MessageKey };

export const LANG_KEY = 'afridev.locale';

/** Fonction standalone de traduction avec fallback automatique. */
export function t(key: MessageKey, locale: LocaleCode = 'fr'): string {
  const dict = MESSAGES[locale] ?? MESSAGES[getFallbackLocale(locale)] ?? fr;
  return dict[key] ?? fr[key] ?? key;
}

interface LangContextValue {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
  currentLang: LangMeta;
  t: (key: MessageKey) => string;
  isRtl: boolean;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocalePref] = useLocalPreference<LocaleCode>(LANG_KEY, 'fr');

  const currentLang = useMemo<LangMeta>(() => {
    return LANG_MAP.get(locale) ?? (LANG_MAP.get('fr') as LangMeta);
  }, [locale]);

  const isRtl = currentLang.dir === 'rtl';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    }
  }, [locale, isRtl]);

  const value = useMemo<LangContextValue>(() => {
    const dict = MESSAGES[locale] ?? MESSAGES[getFallbackLocale(locale)] ?? fr;
    return {
      locale,
      setLocale: setLocalePref,
      currentLang,
      isRtl,
      t: (key: MessageKey) => dict[key] ?? fr[key] ?? key,
    };
  }, [locale, currentLang, isRtl, setLocalePref]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** Hook pour accéder à la langue active et aux traductions dans les composants React. */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Fallback safe si utilisé hors provider
    const fallbackLang = LANG_MAP.get('fr') as LangMeta;
    return {
      locale: 'fr',
      setLocale: () => {},
      currentLang: fallbackLang,
      t: (key: MessageKey) => fr[key] ?? key,
      isRtl: false,
    };
  }
  return ctx;
}

/** Synchronise la langue du <html> (pour insertion dans AppProviders). */
export function LangSync() {
  const { locale, isRtl } = useLang();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    }
  }, [locale, isRtl]);
  return null;
}
