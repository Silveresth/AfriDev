import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

// Service worker (PWA hors ligne). Serwist s'appuie sur webpack : d'où `next build --webpack`.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
