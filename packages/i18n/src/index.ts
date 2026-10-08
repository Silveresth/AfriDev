/**
 * Langues d'AfriDev Exchange, communes au web et au mobile : catalogue des langues (africaines et
 * internationales), dictionnaires traduits et repli intelligent (langue voisine, puis français).
 */
import {
  COMPLETE_LOCALES,
  getFallbackLocale,
  LANG_MAP,
  LANGUAGES,
  type LangMeta,
  type LocaleCode,
} from './languages';
import am from './locales/am';
import ar from './locales/ar';
import bm from './locales/bm';
import dyu from './locales/dyu';
import en from './locales/en';
import fr, { type LocaleMessages, type MessageKey } from './locales/fr';
import ha from './locales/ha';
import ig from './locales/ig';
import ln from './locales/ln';
import mos from './locales/mos';
import pt from './locales/pt';
import rw from './locales/rw';
import sw from './locales/sw';
import wo from './locales/wo';
import yo from './locales/yo';
import zu from './locales/zu';

export { COMPLETE_LOCALES, getFallbackLocale, LANG_MAP, LANGUAGES };
export type { LangMeta, LocaleCode, LocaleMessages, MessageKey };

/** Dictionnaires complets chargés statiquement (~70 Ko au total, 100 % hors ligne). */
export const MESSAGES: Record<string, LocaleMessages> = {
  fr,
  en,
  ar,
  pt,
  wo,
  bm,
  dyu,
  mos,
  ha,
  yo,
  ig,
  ln,
  rw,
  sw,
  am,
  zu,
};

export { fr as FRENCH };

/** Dictionnaire d'une langue, ou de sa langue de repli. */
export function messagesFor(locale: LocaleCode): LocaleMessages {
  return MESSAGES[locale] ?? MESSAGES[getFallbackLocale(locale)] ?? fr;
}

/** Traduction avec repli automatique : langue, langue voisine, français, puis la clé elle-même. */
export function translate(key: MessageKey, locale: LocaleCode = 'fr'): string {
  return messagesFor(locale)[key] ?? fr[key] ?? key;
}
