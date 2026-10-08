'use client';

import { BadgeCheck, MapPin, UsersRound } from 'lucide-react';
import Link from 'next/link';

import { formatCount } from '@/shared/lib';
import { HubIcon } from '@/shared/ui';

import type { Hub } from '../api';
import { JoinButton } from './JoinButton';

export function VerifiedMark({ className }: { className?: string }) {
  return <BadgeCheck className={className ?? 'size-4 text-secondary'} aria-label="Hub certifié par AfriDev" />;
}

export const memberLabel = (count: number) => `${formatCount(count)} membre${count > 1 ? 's' : ''}`;

/** Carte de la page d'exploration : identité du hub, description, membres, bouton Rejoindre. */
export function HubCard({ hub }: { hub: Hub }) {
  return (
    <article className="group relative flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised">
      <div className="flex items-start gap-3">
        <HubIcon icon={hub.icon} name={hub.name} size={44} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1 truncate text-body-md font-semibold text-ink">
            <Link href={`/h/${hub.slug}`} className="truncate after:absolute after:inset-0 after:rounded-2xl group-hover:text-primary-ink">
              {hub.name}
            </Link>
            {hub.is_verified ? <VerifiedMark className="size-4 shrink-0 text-secondary" /> : null}
          </h3>
          <p className="truncate text-label-md text-ink-faint">h/{hub.slug}</p>
        </div>
        <span className="relative z-10">
          <JoinButton hub={hub} />
        </span>
      </div>
      {hub.description ? <p className="line-clamp-2 text-body-sm text-ink-muted">{hub.description}</p> : null}
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <UsersRound className="size-3.5" aria-hidden /> {memberLabel(hub.member_count)}
        </span>
        {hub.target_country ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {hub.target_country}
          </span>
        ) : null}
      </p>
    </article>
  );
}
