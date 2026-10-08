import {
  FRENCH as sharedFr,
  getFallbackLocale,
  LANG_MAP,
  LANGUAGES,
  type LangMeta,
  type LocaleCode,
  messagesFor,
  type MessageKey,
} from '@afridev/i18n';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, DevSettings, I18nManager, Platform } from 'react-native';

import { MOBILE_MESSAGES, type MobileKey, mobileFr } from './messages';

export { LANG_MAP, LANGUAGES };
export type { LangMeta, LocaleCode };

/** Clé d'un texte : propre au mobile, ou partagée avec le web (packages/i18n). */
export type Key = MobileKey | MessageKey;
export type Vars = Record<string, string | number>;

const LANG_KEY = 'afridev.locale';

/** Langue active, lisible hors React (messages d'erreur réseau, dates). */
let current: LocaleCode = 'fr';
const listeners = new Set<() => void>();

/** Langues parlées surtout dans des pays anglophones (ou lusophones) : repli sur l'anglais avant le français. */
const ENGLISH_SECOND = new Set(['ha', 'yo', 'ig', 'sw', 'zu', 'am', 'pt', 'xh', 'st', 'tn', 'sn', 'nd', 'lg', 'ak', 'gaa', 'om', 'so', 'ti']);

/**
 * Ordre de recherche d'un texte : langue choisie (mobile puis web), langue voisine,
 * anglais pour les pays anglophones, enfin français (langue de référence, toujours complète).
 */
function lookup(key: Key, locale: LocaleCode): string {
  const fallback = getFallbackLocale(locale);
  const second = ENGLISH_SECOND.has(locale) || ENGLISH_SECOND.has(fallback) ? 'en' : 'fr';
  const chain = [
    MOBILE_MESSAGES[locale]?.[key as MobileKey],
    messagesFor(locale)[key as MessageKey],
    MOBILE_MESSAGES[fallback]?.[key as MobileKey],
    messagesFor(fallback)[key as MessageKey],
    MOBILE_MESSAGES[second]?.[key as MobileKey],
    messagesFor(second as LocaleCode)[key as MessageKey],
    (mobileFr as Record<string, string>)[key],
    (sharedFr as Record<string, string>)[key],
  ];
  return chain.find((value): value is string => typeof value === 'string') ?? key;
}

function format(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Traduction hors composant (utilise la langue active). */
export function t(key: Key, vars?: Vars, locale: LocaleCode = current): string {
  return format(lookup(key, locale), vars);
}

/** Pluriel simple : `<clé>.one` (0 ou 1) ou `<clé>.other`, avec {count}. */
export function tp(key: string, count: number, vars?: Vars, locale: LocaleCode = current): string {
  return t(`${key}.${count > 1 ? 'other' : 'one'}` as Key, { count, ...vars }, locale);
}

export const currentLocale = () => current;

async function readLocale(): Promise<LocaleCode> {
  try {
    const value = Platform.OS === 'web' ? globalThis.localStorage?.getItem(LANG_KEY) : await SecureStore.getItemAsync(LANG_KEY);
    return value && LANG_MAP.has(value as LocaleCode) ? (value as LocaleCode) : 'fr';
  } catch {
    return 'fr';
  }
}

function writeLocale(value: LocaleCode) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(LANG_KEY, value);
    else void SecureStore.setItemAsync(LANG_KEY, value);
  } catch {
    // préférence non retenue : français au prochain lancement
  }
}

/**
 * Sens d'écriture : React Native ne peut l'inverser qu'au démarrage. Renvoie vrai si un
 * redémarrage est nécessaire pour appliquer le nouveau sens (arabe ↔ autres langues).
 */
function applyDirection(locale: LocaleCode): boolean {
  const rtl = LANG_MAP.get(locale)?.dir === 'rtl';
  if (Platform.OS === 'web') {
    globalThis.document?.documentElement?.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    return false;
  }
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
}

/** Propose de relancer l'appli (immédiat en développement / Expo Go, sinon au prochain lancement). */
function askRestart(locale: LocaleCode) {
  const later = { text: t('lang.restart_later', undefined, locale), style: 'cancel' as const };
  Alert.alert(
    t('lang.restart_title', undefined, locale),
    t(__DEV__ ? 'lang.restart_body' : 'lang.restart_next', undefined, locale),
    __DEV__ ? [later, { text: t('lang.restart_now', undefined, locale), onPress: () => DevSettings.reload() }] : [later],
  );
}

interface LangValue {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
  currentLang: LangMeta;
  t: (key: Key, vars?: Vars) => string;
  tp: (key: string, count: number, vars?: Vars) => string;
}

const LangContext = createContext<LangValue | null>(null);

/** Langue de l'interface (même préférence et même catalogue que le web). */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(current);

  useEffect(() => {
    void readLocale().then((value) => {
      current = value;
      setLocaleState(value);
      // Sens mémorisé différent de la langue (ex. réglage changé hors ligne) : appliqué au prochain lancement.
      applyDirection(value);
    });
  }, []);

  const setLocale = useCallback((code: LocaleCode) => {
    current = code;
    setLocaleState(code);
    writeLocale(code);
    listeners.forEach((listener) => listener());
    if (applyDirection(code)) askRestart(code);
  }, []);

  const value = useMemo<LangValue>(
    () => ({
      locale,
      setLocale,
      currentLang: LANG_MAP.get(locale) ?? (LANG_MAP.get('fr') as LangMeta),
      t: (key, vars) => t(key, vars, locale),
      tp: (key, count, vars) => tp(key, count, vars, locale),
    }),
    [locale, setLocale],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang doit être utilisé sous <LangProvider>.');
  return value;
}

/** Raccourci : `const { t } = useT()`. */
export const useT = useLang;
