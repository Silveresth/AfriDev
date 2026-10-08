'use client';

import { useEffect, useRef } from 'react';

import { tokenStore, WS_URL } from '@/shared/api';

/**
 * WebSocket temps réel (commentaires, notifications) authentifié par ?token=<jwt>.
 * Reconnexion avec attente croissante (1 s → 30 s), suspendue hors ligne : sur un réseau
 * instable on ne gaspille ni batterie ni forfait à réessayer en boucle.
 */
export function useLiveSocket<T>(path: string | null, onMessage: (message: T) => void) {
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  useEffect(() => {
    if (!path) return;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      const token = tokenStore.get();
      if (closed || !token || !navigator.onLine) return;
      socket = new WebSocket(`${WS_URL}${path}?token=${encodeURIComponent(token)}`);
      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          handler.current(JSON.parse(event.data as string) as T);
        } catch {
          // message illisible : ignoré
        }
      };
      socket.onclose = () => {
        if (closed) return;
        attempt += 1;
        timer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt));
      };
    };

    const onOnline = () => {
      window.clearTimeout(timer);
      attempt = 0;
      if (!socket || socket.readyState === WebSocket.CLOSED) connect();
    };

    connect();
    window.addEventListener('online', onOnline);
    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      socket?.close();
    };
  }, [path]);
}
