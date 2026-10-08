/**
 * Registre complet des langues supportées par AfriDev Exchange.
 */

export type LocaleCode =
  // ── Langues complètes (traduction disponible) ──
  | 'fr' | 'en' | 'ar' | 'pt'
  | 'wo' | 'bm' | 'dyu' | 'mos'
  | 'sw' | 'ha' | 'yo' | 'ig'
  | 'ln' | 'rw' | 'zu' | 'am'
  // ── Autres langues régionales africaines ──
  | 'xh' | 'st' | 'tn' | 'nso' | 'ts' | 've'   // Afrique du Sud
  | 'sn' | 'nd'                               // Zimbabwe
  | 'rn'                                      // Burundi
  | 'lg' | 'sw-ug'                            // Ouganda
  | 'mg'                                      // Madagascar
  | 'ff' | 'snk' | 'mnk'                      // Sénégal / Ouest
  | 'ee' | 'ak' | 'tw' | 'gaa'                // Ghana / Togo
  | 'kr' | 'ff-ne'                            // Niger
  | 'kg' | 'lu' | 'sw-cd'                     // RDC
  | 'sg'                                      // Centrafrique (Sango)
  | 'ti'                                      // Érythrée / Éthiopie (Tigrinya)
  | 'om' | 'so'                               // Corne de l'Afrique
  | 'ber' | 'kab'                             // Maghreb (Amazigh)
  ;

export interface LangMeta {
  /** Code ISO 639 ou BCP 47 */
  code: LocaleCode;
  /** Nom dans la langue elle-même */
  native: string;
  /** Nom en français */
  label: string;
  /** Emoji drapeau principal */
  flag: string;
  /** Pays principaux */
  countries: string[];
  /** Catégorie */
  category: 'african' | 'international';
  /** true = traduction disponible dans locales/ */
  complete: boolean;
  /** Direction du texte */
  dir?: 'ltr' | 'rtl';
}

/** Catalogue complet des langues */
export const LANGUAGES: LangMeta[] = [
  // ────────────────────────────────────────────────────────
  //  LANGUES INTERNATIONALES
  // ────────────────────────────────────────────────────────
  { code: 'fr',  native: 'Français',    label: 'Français',    flag: '🇫🇷', countries: ['Sénégal', 'Côte d\'Ivoire', 'Mali', 'Cameroun', 'RDC', 'Burkina', 'Guinée', 'Niger', 'Bénin', 'Togo', 'Madagascar', 'Gabon', 'Congo'], category: 'international', complete: true },
  { code: 'en',  native: 'English',     label: 'Anglais',     flag: '🇬🇧', countries: ['Nigeria', 'Ghana', 'Kenya', 'Afrique du Sud', 'Tanzanie', 'Ouganda', 'Rwanda', 'Cameroun'], category: 'international', complete: true },
  { code: 'ar',  native: 'العربية',      label: 'Arabe',       flag: '🇸🇦', countries: ['Maroc', 'Algérie', 'Tunisie', 'Égypte', 'Libye', 'Soudan', 'Mauritanie'], category: 'international', complete: true, dir: 'rtl' },
  { code: 'pt',  native: 'Português',   label: 'Portugais',   flag: '🇵🇹', countries: ['Angola', 'Mozambique', 'Guinée-Bissau', 'Cap-Vert', 'São Tomé'], category: 'international', complete: true },

  // ────────────────────────────────────────────────────────
  //  AFRIQUE DE L'OUEST
  // ────────────────────────────────────────────────────────
  { code: 'wo',  native: 'Wolof',       label: 'Wolof',       flag: '🇸🇳', countries: ['Sénégal', 'Gambie', 'Mauritanie'], category: 'african', complete: true },
  { code: 'bm',  native: 'Bamanankan',  label: 'Bambara',     flag: '🇲🇱', countries: ['Mali', 'Burkina Faso', 'Côte d\'Ivoire'], category: 'african', complete: true },
  { code: 'dyu', native: 'Julakan',     label: 'Dioula',      flag: '🇨🇮', countries: ['Côte d\'Ivoire', 'Burkina Faso', 'Mali'], category: 'african', complete: true },
  { code: 'mos', native: 'Mòoré',       label: 'Mooré',       flag: '🇧🇫', countries: ['Burkina Faso'], category: 'african', complete: true },
  { code: 'ha',  native: 'Hausa',       label: 'Haoussa',     flag: '🇳🇬', countries: ['Nigeria', 'Niger', 'Ghana', 'Cameroun'], category: 'african', complete: true },
  { code: 'yo',  native: 'Yorùbá',      label: 'Yoruba',      flag: '🇳🇬', countries: ['Nigeria', 'Bénin', 'Togo'], category: 'african', complete: true },
  { code: 'ig',  native: 'Igbo',        label: 'Igbo',        flag: '🇳🇬', countries: ['Nigeria'], category: 'african', complete: true },
  { code: 'ff',  native: 'Pulaar',      label: 'Peul / Fulfulde', flag: '🇬🇳', countries: ['Guinée', 'Sénégal', 'Mali', 'Niger', 'Nigeria', 'Cameroun'], category: 'african', complete: false },
  { code: 'snk', native: 'Soninkanxanné', label: 'Soninké',   flag: '🇲🇱', countries: ['Mali', 'Sénégal', 'Mauritanie', 'Gambie'], category: 'african', complete: false },
  { code: 'mnk', native: 'Mandinka',    label: 'Mandingue',   flag: '🇬🇲', countries: ['Gambie', 'Guinée-Bissau', 'Sénégal', 'Mali'], category: 'african', complete: false },
  { code: 'ee',  native: 'Eʋegbe',      label: 'Éwé',         flag: '🇹🇬', countries: ['Togo', 'Ghana', 'Bénin'], category: 'african', complete: false },
  { code: 'ak',  native: 'Akan',        label: 'Akan / Twi',  flag: '🇬🇭', countries: ['Ghana'], category: 'african', complete: false },
  { code: 'gaa', native: 'Gã',          label: 'Ga',          flag: '🇬🇭', countries: ['Ghana'], category: 'african', complete: false },

  // ────────────────────────────────────────────────────────
  //  AFRIQUE CENTRALE
  // ────────────────────────────────────────────────────────
  { code: 'ln',  native: 'Lingála',     label: 'Lingala',     flag: '🇨🇩', countries: ['RDC', 'Congo-Brazzaville', 'RCA'], category: 'african', complete: true },
  { code: 'rw',  native: 'Ikinyarwanda', label: 'Kinyarwanda', flag: '🇷🇼', countries: ['Rwanda'], category: 'african', complete: true },
  { code: 'kg',  native: 'Kikongo',     label: 'Kikongo',     flag: '🇨🇩', countries: ['RDC', 'Congo-Brazzaville', 'Angola'], category: 'african', complete: false },
  { code: 'lu',  native: 'Tshiluba',    label: 'Luba-Kasaï',  flag: '🇨🇩', countries: ['RDC'], category: 'african', complete: false },
  { code: 'sg',  native: 'Sängö',       label: 'Sango',       flag: '🇨🇫', countries: ['République centrafricaine'], category: 'african', complete: false },
  { code: 'rn',  native: 'Ikirundi',    label: 'Kirundi',     flag: '🇧🇮', countries: ['Burundi'], category: 'african', complete: false },

  // ────────────────────────────────────────────────────────
  //  AFRIQUE DE L'EST
  // ────────────────────────────────────────────────────────
  { code: 'sw',  native: 'Kiswahili',   label: 'Swahili',     flag: '🇰🇪', countries: ['Kenya', 'Tanzanie', 'RDC', 'Ouganda', 'Mozambique'], category: 'african', complete: true },
  { code: 'am',  native: 'አማርኛ',         label: 'Amharique',   flag: '🇪🇹', countries: ['Éthiopie'], category: 'african', complete: true },
  { code: 'ti',  native: 'ትግርኛ',         label: 'Tigrinya',    flag: '🇪🇷', countries: ['Érythrée', 'Éthiopie'], category: 'african', complete: false },
  { code: 'om',  native: 'Oromoo',      label: 'Oromo',       flag: '🇪🇹', countries: ['Éthiopie', 'Kenya'], category: 'african', complete: false },
  { code: 'so',  native: 'Soomaali',    label: 'Somali',      flag: '🇸🇴', countries: ['Somalie', 'Djibouti', 'Éthiopie', 'Kenya'], category: 'african', complete: false },
  { code: 'lg',  native: 'Luganda',     label: 'Ganda',       flag: '🇺🇬', countries: ['Ouganda'], category: 'african', complete: false },

  // ────────────────────────────────────────────────────────
  //  AFRIQUE AUSTRALE
  // ────────────────────────────────────────────────────────
  { code: 'zu',  native: 'isiZulu',     label: 'Zoulou',      flag: '🇿🇦', countries: ['Afrique du Sud'], category: 'african', complete: true },
  { code: 'xh',  native: 'isiXhosa',    label: 'Xhosa',       flag: '🇿🇦', countries: ['Afrique du Sud'], category: 'african', complete: false },
  { code: 'st',  native: 'Sesotho',     label: 'Sotho',       flag: '🇱🇸', countries: ['Lesotho', 'Afrique du Sud'], category: 'african', complete: false },
  { code: 'tn',  native: 'Setswana',    label: 'Tswana',      flag: '🇧🇼', countries: ['Botswana', 'Afrique du Sud'], category: 'african', complete: false },
  { code: 'sn',  native: 'chiShona',    label: 'Shona',       flag: '🇿🇼', countries: ['Zimbabwe', 'Mozambique'], category: 'african', complete: false },
  { code: 'nd',  native: 'isiNdebele',  label: 'Ndébélé',     flag: '🇿🇼', countries: ['Zimbabwe', 'Afrique du Sud'], category: 'african', complete: false },

  // ────────────────────────────────────────────────────────
  //  MADAGASCAR & MAGHREB
  // ────────────────────────────────────────────────────────
  { code: 'mg',  native: 'Malagasy',    label: 'Malgache',    flag: '🇲🇬', countries: ['Madagascar'], category: 'african', complete: false },
  { code: 'ber', native: 'ⵜⴰⵎⴰⵣⵉⵖⵜ',    label: 'Amazigh',     flag: '🇲🇦', countries: ['Maroc', 'Algérie', 'Libye', 'Tunisie', 'Niger', 'Mali'], category: 'african', complete: false },
  { code: 'kab', native: 'Taqbaylit',   label: 'Kabyle',      flag: '🇩🇿', countries: ['Algérie'], category: 'african', complete: false },
];

/** Lookup rapide par code */
export const LANG_MAP = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Langues avec traduction complète */
export const COMPLETE_LOCALES = LANGUAGES.filter((l) => l.complete).map((l) => l.code);

/** Fallback intelligent selon la parenté linguistique et la région */
export function getFallbackLocale(code: LocaleCode): LocaleCode {
  const meta = LANG_MAP.get(code);
  if (!meta) return 'fr';
  if (meta.complete) return code;

  // Rapprochements linguistiques directs
  if (code === 'rn') return 'rw'; // Kirundi -> Kinyarwanda
  if (code === 'xh' || code === 'nd' || code === 'st' || code === 'tn') return 'zu'; // Nguni / Sotho -> Zulu
  if (code === 'kg' || code === 'lu' || code === 'sg') return 'ln'; // RDC / Centrafrique -> Lingala
  if (code === 'snk' || code === 'mnk') return 'bm'; // Mandé -> Bambara
  if (code === 'ti') return 'am'; // Érythrée / Éthiopie -> Amharic
  if (code === 'om' || code === 'so' || code === 'lg') return 'sw'; // Corne / Est -> Swahili
  if (code === 'kab' || code === 'ber') return 'ar'; // Maghreb -> Arabe

  // Pays anglophones -> fallback en
  const enCountries = ['Nigeria', 'Ghana', 'Kenya', 'Afrique du Sud', 'Tanzanie', 'Ouganda', 'Zimbabwe'];
  if (meta.countries.some((c) => enCountries.includes(c))) return 'en';

  return 'fr';
}
