import { Platform } from 'react-native';

/**
 * Jetons de couleur identiques à web/src/styles/globals.css : neutres zinc, terre cuite AfriDev
 * en accent. Uniquement des aplats (aucun dégradé), filets fins plutôt qu'ombres.
 */
export const light = {
  background: '#FFFFFF',
  surface: '#FAFAFA',
  container: '#F0F0F2',
  containerHigh: '#E7E7EA',
  pressed: '#F4F4F5',
  line: '#E6E6E9',
  lineStrong: '#D0D0D6',
  ink: '#0A0A0B',
  inkMuted: '#52525B',
  inkFaint: '#75757E',

  primary: '#C84B20',
  primaryPressed: '#B2401A',
  primaryInk: '#A63306',
  primarySoft: '#FCEBE4',
  onPrimary: '#FFFFFF',

  secondary: '#1A7F4B',
  secondaryInk: '#17663D',
  secondarySoft: '#E3F6EA',

  tertiary: '#B45309',
  tertiarySoft: '#FDF0E1',

  downvote: '#6A5CFF',
  downvoteSoft: '#ECEBFF',

  danger: '#D1242F',
  dangerSoft: '#FFEBE9',

  codeBg: '#0D1117',
  codeInk: '#E6EDF3',
  scrim: 'rgba(10, 10, 11, 0.4)',
};

export type Palette = typeof light;

export const dark: Palette = {
  background: '#09090B',
  surface: '#111113',
  container: '#1B1B1F',
  containerHigh: '#242429',
  pressed: '#18181B',
  line: '#232328',
  lineStrong: '#34343B',
  ink: '#EDEDEF',
  inkMuted: '#A1A1AA',
  inkFaint: '#7A7A83',

  primary: '#D4572A',
  primaryPressed: '#E06535',
  primaryInk: '#FF9B76',
  primarySoft: '#2B1710',
  onPrimary: '#FFFFFF',

  secondary: '#23874F',
  secondaryInk: '#6FD59C',
  secondarySoft: '#0F2A1B',

  tertiary: '#D97706',
  tertiarySoft: '#2F1F0D',

  downvote: '#8B80FF',
  downvoteSoft: '#1F1D3D',

  danger: '#FF6A69',
  dangerSoft: '#2F1214',

  codeBg: '#0A0D12',
  codeInk: '#E6EDF3',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

/** Couleurs de fond des avatars sans photo (déduites du nom, comme sur le web). */
export const AVATAR_COLORS = ['#C84B20', '#1A7F4B', '#B45309', '#7C3AED', '#0E7490', '#2563EB'];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** Échelle typographique (police système : nette et sans téléchargement). */
export const typography = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  smallStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypeVariant = keyof typeof typography;
