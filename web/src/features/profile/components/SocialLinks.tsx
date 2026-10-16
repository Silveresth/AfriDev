'use client';

import { SOCIAL_NETWORK_KEYS, type SocialNetwork } from '@afridev/validation';
import { BookOpen, Code2, Facebook, Github, Gitlab, Globe, Instagram, Linkedin, type LucideIcon, Music2, Youtube } from 'lucide-react';

import { cn } from '@/shared/lib';

import type { SocialLinks as Links } from '../api';

/** Logo X (ex-Twitter) : absent de lucide. */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export const SOCIAL_META: Record<SocialNetwork, { label: string; icon: LucideIcon | typeof XLogo; placeholder: string }> = {
  github: { label: 'GitHub', icon: Github, placeholder: 'https://github.com/pseudo' },
  gitlab: { label: 'GitLab', icon: Gitlab, placeholder: 'https://gitlab.com/pseudo' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/pseudo' },
  twitter: { label: 'X (Twitter)', icon: XLogo, placeholder: 'https://x.com/pseudo' },
  tiktok: { label: 'TikTok', icon: Music2, placeholder: 'https://tiktok.com/@pseudo' },
  instagram: { label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/pseudo' },
  youtube: { label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@chaine' },
  facebook: { label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/pseudo' },
  dev: { label: 'DEV', icon: Code2, placeholder: 'https://dev.to/pseudo' },
  medium: { label: 'Medium', icon: BookOpen, placeholder: 'https://medium.com/@pseudo' },
  portfolio: { label: 'Portfolio', icon: Globe, placeholder: 'https://mon-site.dev' },
};

/** Ligne d'icônes rondes, une par réseau renseigné (ordre fixe). */
export function SocialLinks({ links, className, tone = 'default' }: { links?: Links | null; className?: string; tone?: 'default' | 'onDark' }) {
  const entries = SOCIAL_NETWORK_KEYS.flatMap((network) => {
    const url = links?.[network];
    return url ? [{ network, url }] : [];
  });
  if (!entries.length) return null;
  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Réseaux sociaux">
      {entries.map(({ network, url }) => {
        const { label, icon: Icon } = SOCIAL_META[network];
        return (
          <li key={network}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow me"
              title={label}
              aria-label={label}
              className={cn(
                'flex size-9 items-center justify-center rounded-full transition-all hover:-translate-y-0.5',
                tone === 'onDark'
                  ? 'bg-white/12 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-white/20'
                  : 'bg-container text-ink-muted ring-1 ring-line hover:text-ink hover:ring-line-strong',
              )}
            >
              <Icon className="size-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
