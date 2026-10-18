import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  RangeRequestsPlugin,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

import { notificationHref } from '@/shared/lib/notification-links';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const runtimeCaching: RuntimeCaching[] = [
  // 1. Ne jamais cacher les API ou PowerSync
  {
    matcher: ({ url: { pathname } }) =>
      pathname.startsWith('/api/') || pathname.startsWith('/sync/'),
    handler: new NetworkOnly(),
  },
  // 2. Next.js RSC (React Server Components) : réseau pur pour éviter les erreurs Cache.put
  {
    matcher: ({ request }) =>
      request.headers.get('RSC') === '1' ||
      request.headers.get('Next-Router-State-Tree') !== null ||
      request.headers.get('Next-Router-Prefetch') !== null,
    handler: new NetworkOnly(),
  },
  // 3. Polices Google Fonts
  {
    matcher: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
    handler: new CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 31536000,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  {
    matcher: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
    handler: new StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 604800,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  // 4. Polices statiques
  {
    matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: 'static-font-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 8,
          maxAgeSeconds: 604800,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  // 5. Assets statiques Next.js (JS, CSS)
  {
    matcher: /\/_next\/static.+\.(?:js|css)$/i,
    handler: new CacheFirst({
      cacheName: 'next-static-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 86400,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  // 6. Optimisation d'images Next.js
  {
    matcher: /\/_next\/image\?url=.+$/i,
    handler: new StaleWhileRevalidate({
      cacheName: 'next-image',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 86400,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  // 7. Images statiques
  {
    matcher: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: 'static-image-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 2592000,
          maxAgeFrom: 'last-used',
        }),
      ],
    }),
  },
  // 8. Médias audio / vidéo
  {
    matcher: /\.(?:mp3|wav|ogg|mp4|webm)$/i,
    handler: new CacheFirst({
      cacheName: 'static-media-assets',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
          maxAgeFrom: 'last-used',
        }),
        new RangeRequestsPlugin(),
      ],
    }),
  },
  // 9. Documents / navigations de pages : NetworkOnly avec fallback offline
  {
    matcher: ({ request }) => request.destination === 'document' || request.mode === 'navigate',
    handler: new NetworkOnly(),
  },
  // 10. Défaut global : NetworkOnly
  {
    matcher: /.*/i,
    handler: new NetworkOnly(),
  },
];

// Supervision (/monitoring/, Basic Auth nginx) : jamais interceptée. Un 401 relayé par le service
// worker n'ouvre pas la fenêtre de mot de passe du navigateur ; on laisse donc le navigateur faire.
// Enregistré avant Serwist : stopImmediatePropagation l'empêche de répondre à ces requêtes.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/monitoring/')) {
    event.stopImmediatePropagation();
  }
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();

// ── Notifications push (Web Push) ──
interface PushMessage {
  title?: string;
  body?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

self.addEventListener('push', (event) => {
  let message: PushMessage = {};
  try {
    message = (event.data?.json() ?? {}) as PushMessage;
  } catch {
    message = { body: event.data?.text() };
  }
  event.waitUntil(
    (async () => {
      // Onglet ouvert et au premier plan : la notification arrive déjà en direct (WebSocket).
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((client) => client.focused && client.visibilityState === 'visible')) return;
      await self.registration.showNotification(message.title || 'AfriDev Exchange', {
        body: message.body,
        tag: message.tag,
        icon: '/icons/icon-192.png',
        lang: 'fr',
        data: { url: notificationHref(message.data) ?? '/notifications' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string })?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const tab = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (tab) {
        await tab.focus();
        await tab.navigate(url).catch(() => undefined);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

// Nettoyage automatique des anciens caches corrompus lors de l'activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) =>
            ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'others', 'cross-origin'].includes(key)
          )
          .map((key) => caches.delete(key))
      )
    )
  );
});
