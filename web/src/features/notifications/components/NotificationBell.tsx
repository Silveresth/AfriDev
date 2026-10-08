'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/shared/lib';
import { useLiveSocket } from '@/shared/realtime/useLiveSocket';
import { useSession } from '@/shared/session';
import { useToast } from '@/shared/ui';

import { notificationKeys, useUnreadCount } from '../api';
import { NotificationPanel } from './NotificationPanel';

interface LiveNotification {
  event: 'notification';
  title: string;
}

/**
 * Cloche de l'en-tête : compteur des non lues mis à jour en direct (WebSocket), et centre de
 * notifications en panneau déroulant (Échap ou clic extérieur pour fermer).
 */
export function NotificationBell() {
  const { isAuthenticated } = useSession();
  const { data: unread = 0 } = useUnreadCount();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useLiveSocket<LiveNotification>(isAuthenticated ? '/ws/notifications/' : null, (message) => {
    if (message.event !== 'notification') return;
    if (!open) toast(message.title, 'queued');
    setRinging(Date.now());
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={unread ? `Notifications : ${unread} non lues` : 'Notifications'}
        title="Notifications"
        className={cn(
          'relative flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-container hover:text-ink',
          open && 'bg-container text-ink',
        )}
      >
        <Bell key={ringing} className={cn('size-[18px]', ringing > 0 && 'animate-bell')} aria-hidden />
        {unread ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-bold text-on-primary tabular-nums ring-2 ring-card">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? <NotificationPanel id={panelId} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
