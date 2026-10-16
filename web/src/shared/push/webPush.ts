'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { api, unwrap } from '@/shared/api';

/**
 * État des notifications push de ce navigateur :
 * - unsupported : navigateur sans Web Push (ou service worker absent, ex. en développement) ;
 * - ios-install : iPhone/iPad, le site doit d'abord être ajouté à l'écran d'accueil ;
 * - unavailable : serveur sans clé VAPID ;
 * - denied : refusées dans les réglages du navigateur ;
 * - off / on : prêtes, désactivées ou actives sur cet appareil.
 */
export type WebPushStatus = 'loading' | 'unsupported' | 'ios-install' | 'unavailable' | 'denied' | 'off' | 'on';

const CONFIG_KEY = ['notifications', 'web-push', 'config'] as const;
const SUBSCRIPTION_KEY = ['notifications', 'web-push', 'subscription'] as const;
const SYNCED_KEY = 'afridev:webpush-synced';

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function hasPushApi() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Enregistrement du service worker, sans attendre indéfiniment s'il n'y en a pas. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!hasPushApi()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

function toKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function save(subscription: PushSubscription) {
  const json = subscription.toJSON();
  await unwrap(
    api.POST('/api/notifications/web-push/', {
      body: { endpoint: json.endpoint ?? subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } },
    }),
  );
}

function useWebPushConfig(enabled: boolean) {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => unwrap(api.GET('/api/notifications/web-push/')),
    enabled,
    staleTime: Infinity,
    meta: { persist: false },
  });
}

/** Réglages > Notifications : activer / couper le push sur ce navigateur. */
export function useWebPush() {
  const supported = hasPushApi();
  const config = useWebPushConfig(supported);
  const [busy, setBusy] = useState(false);
  const publicKey = config.data?.public_key ?? null;
  // null : aucun service worker (développement) ; sinon, abonnement présent ou non.
  const subscribed = useQuery({
    queryKey: SUBSCRIPTION_KEY,
    queryFn: async () => {
      const reg = await registration();
      return reg ? { active: Boolean(await reg.pushManager.getSubscription()) } : null;
    },
    enabled: supported,
    meta: { persist: false },
  });

  let status: WebPushStatus;
  if (!supported) status = typeof window !== 'undefined' && isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  else if (config.isPending || subscribed.isPending) status = 'loading';
  else if (!publicKey) status = 'unavailable';
  else if (!subscribed.data) status = 'unsupported';
  else if (Notification.permission === 'denied') status = 'denied';
  else status = subscribed.data.active ? 'on' : 'off';

  const refresh = subscribed.refetch;

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const reg = await registration();
      if (!reg) return;
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      await save(subscription);
      sessionStorage.setItem(SYNCED_KEY, '1');
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [publicKey, refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeWebPush();
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [refresh]);

  return { status, busy, enable, disable };
}

/**
 * Désabonne ce navigateur. À la déconnexion (`server: false`), la session n'est déjà plus
 * valable : l'abonnement est seulement révoqué côté navigateur, le serveur le supprimera à
 * son prochain envoi (réponse 410). Le membre suivant ne reçoit donc pas ses alertes.
 */
export async function unsubscribeWebPush({ server = true }: { server?: boolean } = {}) {
  try {
    const subscription = await (await registration())?.pushManager.getSubscription();
    if (!subscription) return;
    if (server) {
      await unwrap(api.POST('/api/notifications/web-push/unsubscribe/', { body: { endpoint: subscription.endpoint } })).catch(
        () => undefined,
      );
    }
    await subscription.unsubscribe();
  } catch {
    // Hors ligne ou API indisponible : l'abonnement expirera côté serveur (410).
  } finally {
    sessionStorage.removeItem(SYNCED_KEY);
  }
}

/**
 * Une fois par session, renvoie au serveur l'abonnement déjà accordé : il a pu être purgé
 * (expiré, autre compte sur ce navigateur) ou renouvelé par le navigateur.
 */
export function WebPushSync({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !hasPushApi() || Notification.permission !== 'granted') return;
    if (sessionStorage.getItem(SYNCED_KEY)) return;
    void (async () => {
      const subscription = await (await registration())?.pushManager.getSubscription();
      if (!subscription) return;
      await save(subscription);
      sessionStorage.setItem(SYNCED_KEY, '1');
    })().catch(() => undefined);
  }, [enabled]);
  return null;
}
