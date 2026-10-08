'use client';

import {
  Coins,
  Cpu,
  Flame,
  Globe,
  Radio,
  Smartphone,
  Sparkles,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/shared/lib';

interface QuickHub {
  tag: string;
  name: string;
  flag?: string;
  icon: typeof Smartphone;
  color: string;
  popular?: boolean;
}

const FEATURED_HUBS: QuickHub[] = [
  { tag: 'mobile-money', name: 'Mobile Money', icon: Coins, color: 'from-amber-500 to-orange-600', popular: true },
  { tag: 'flutter', name: 'Flutter Africa', icon: Smartphone, color: 'from-sky-400 to-blue-600', popular: true },
  { tag: 'ussd-telecom', name: 'USSD & Telecom', icon: Radio, color: 'from-emerald-500 to-teal-700' },
  { tag: 'django-python', name: 'Django & Python', icon: Terminal, color: 'from-emerald-600 to-green-800', popular: true },
  { tag: 'ai-africa', name: 'IA & LLM Afrique', icon: Sparkles, color: 'from-purple-500 to-indigo-600' },
  { tag: 'fintech', name: 'Fintech & APIs', icon: Cpu, color: 'from-rose-500 to-pink-600' },
  { tag: 'open-source', name: 'Open Source AF', icon: Globe, color: 'from-cyan-500 to-blue-600' },
];

/**
 * Carrousel horizontal « Hubs & Tendances » façon Stories / Reddit communities sur mobile.
 * Permet d'explorer et filtrer instantanément le fil d'actualité d'un simple swipe du pouce.
 */
export function MobileHubsBar() {
  const params = useSearchParams();
  const currentTag = params.get('tag');

  return (
    <div className="mb-3 block lg:hidden">
      <div className="flex items-center justify-between px-1 pb-1.5 text-label-sm font-semibold text-ink-muted">
        <span className="flex items-center gap-1">
          <Flame className="size-3.5 text-primary" aria-hidden />
          <span>Hubs populaires</span>
        </span>
        <Link href="/hubs" className="text-[0.7rem] font-medium text-primary hover:underline">
          Voir tous →
        </Link>
      </div>

      <div className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 py-1 overscroll-x-contain">
        {/* Pilule « Tout le fil » */}
        <Link
          href="/feed"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-label-md font-medium transition-transform active:scale-95 select-none',
            !currentTag
              ? 'border-primary bg-primary text-on-primary shadow-xs font-bold'
              : 'border-line bg-card text-ink-muted hover:border-line-strong hover:text-ink',
          )}
        >
          <span>🔥</span>
          <span>Tout le fil</span>
        </Link>

        {/* Hubs vedettes */}
        {FEATURED_HUBS.map((hub) => {
          const active = currentTag === hub.tag;
          const Icon = hub.icon;
          return (
            <Link
              key={hub.tag}
              href={`/feed?tag=${encodeURIComponent(hub.tag)}`}
              className={cn(
                'group flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-label-md font-medium transition-all active:scale-95 select-none',
                active
                  ? 'border-primary bg-primary text-on-primary shadow-xs font-bold'
                  : 'border-line/80 bg-card/90 text-ink hover:border-line-strong',
              )}
            >
              <span
                className={cn(
                  'flex size-5.5 items-center justify-center rounded-full bg-gradient-to-tr text-white text-[10px] shadow-2xs',
                  hub.color,
                )}
              >
                <Icon className="size-3" aria-hidden />
              </span>
              <span className="truncate text-body-sm">{hub.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
