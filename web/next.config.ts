import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

// Service worker (PWA hors ligne). Serwist s'appuie sur webpack : d'où `next build --webpack`.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  // Page de secours mise en cache dès l'installation : sans elle, une navigation qui échoue
  // (réseau coupé, serveur qui redémarre) finit sur une erreur brute du navigateur.
  additionalPrecacheEntries: [{ url: '/offline', revision: `${Date.now()}` }],
});

const isDev = process.env.NODE_ENV === 'development';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').origin;
const wsOrigin = apiOrigin.replace(/^http/, 'ws');

/**
 * Content-Security-Policy. Scripts du site seulement (aucun script d'un autre domaine ne peut
 * être chargé) et connexions limitées à l'API et à Cloudinary : un script injecté ne pourrait
 * ni s'exécuter depuis un serveur tiers, ni y envoyer des données.
 * 'unsafe-inline' reste nécessaire aux scripts inline de Next.js (une CSP à nonce rendrait toutes
 * les pages dynamiques) ; 'wasm-unsafe-eval' sert à SQLite (copie hors ligne PowerSync).
 * Images et vidéos : https (avatars GitHub, aperçus de liens, Cloudinary).
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin} https://api.cloudinary.com https://res.cloudinary.com${isDev ? ' ws: http://localhost:*' : ''}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Navigateur interne : les sites externes s'ouvrent dans un cadre.
  'frame-src https:',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

/** En-têtes de sécurité de toutes les pages (l'API Django envoie déjà les siens). */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Micro : messages vocaux et recherche vocale ; le reste est coupé.
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)' },
  { key: 'Content-Security-Policy', value: CSP },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  // Pas de AGENTS.md / CLAUDE.md générés automatiquement par « next dev ».
  agentRules: false,
  transpilePackages: ['@afridev/api-client', '@afridev/i18n', '@afridev/sync-schema', '@afridev/validation'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  webpack: (config) => {
    // SQLite dans le navigateur (PowerSync / wa-sqlite) charge du WebAssembly.
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};

export default withSerwist(nextConfig);
