import am from './am';
import ar from './ar';
import bm from './bm';
import dyu from './dyu';
import en from './en';
import fr, { type MobileKey, type MobileMessages } from './fr';
import ha from './ha';
import ig from './ig';
import ln from './ln';
import mos from './mos';
import pt from './pt';
import rw from './rw';
import sw from './sw';
import wo from './wo';
import yo from './yo';
import zu from './zu';

export type { MobileKey, MobileMessages };
export { fr as mobileFr };

/** Textes du mobile par langue (les mêmes 16 langues traduites que le web). */
export const MOBILE_MESSAGES: Record<string, MobileMessages> = { fr, en, ar, pt, wo, bm, dyu, mos, ha, yo, ig, ln, rw, sw, am, zu };
