'use client';

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { cn } from '@/shared/lib';

type Tone = 'success' | 'error' | 'queued';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

const ICONS = { success: CheckCircle2, error: XCircle, queued: Clock };

/** Messages éphémères en bas de l'écran (annoncés aux lecteurs d'écran). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                'animate-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-body-sm font-medium shadow-raised',
                item.tone === 'success' && 'bg-ink text-card',
                item.tone === 'error' && 'bg-danger text-white',
                item.tone === 'queued' && 'bg-tertiary text-white',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
