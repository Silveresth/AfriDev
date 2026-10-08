'use client';

import { BriefcaseBusiness, CalendarDays, Globe2 } from 'lucide-react';
import Link from 'next/link';

import { SideCard, Skeleton } from '@/shared/ui';

import { CONTRACTS, EVENT_KINDS, useEvents, useJobs } from '../api';
import { CompanyMark, jobPlace } from './JobCard';

/** « Opportunités récentes » (colonne de droite) : dernières offres du Job Board. */
export function RecentJobsCard() {
  const jobs = useJobs();
  const items = jobs.items.slice(0, 4);
  return (
    <SideCard
      title="Opportunités récentes"
      icon={<BriefcaseBusiness aria-hidden />}
      action={
        <Link href="/jobs" className="text-label-md font-medium text-ink-faint hover:text-ink">
          Tout voir
        </Link>
      }
    >
      {jobs.isPending ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-24" />
        </div>
      ) : items.length ? (
        <ul className="pb-1.5">
          {items.map((job) => (
            <li key={job.id}>
              <Link href="/jobs" className="flex gap-3 px-4 py-2 transition-colors hover:bg-container-low">
                <CompanyMark name={job.company} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-medium text-ink">{job.title}</span>
                  <span className="flex items-center gap-1 truncate text-label-md text-ink-faint">
                    {job.company} · {CONTRACTS[job.contract_type]}
                    {job.is_remote ? (
                      <>
                        {' · '}
                        <Globe2 className="size-3" aria-hidden /> remote
                      </>
                    ) : jobPlace(job) ? (
                      ` · ${job.location || job.country}`
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-body-sm text-ink-muted">Aucune offre pour l&apos;instant.</p>
      )}
    </SideCard>
  );
}

/** Prochains événements (colonne de droite). */
export function UpcomingEventsCard() {
  const events = useEvents();
  const items = events.items.slice(0, 3);
  if (!events.isPending && !items.length) return null;
  return (
    <SideCard
      title="Prochains événements"
      icon={<CalendarDays aria-hidden />}
      action={
        <Link href="/events" className="text-label-md font-medium text-ink-faint hover:text-ink">
          Agenda
        </Link>
      }
    >
      {events.isPending ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-20" />
        </div>
      ) : (
        <ul className="pb-1.5">
          {items.map((event) => {
            const date = new Date(event.starts_at);
            return (
              <li key={event.id}>
                <Link href="/events" className="flex gap-3 px-4 py-2 transition-colors hover:bg-container-low">
                  <span className="flex w-9 shrink-0 flex-col items-center rounded-md border border-line py-0.5 text-center" aria-hidden>
                    <span className="text-[0.625rem] font-semibold text-primary-ink uppercase">
                      {date.toLocaleDateString('fr', { month: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-body-md leading-tight font-semibold text-ink tabular-nums">{date.getDate()}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-body-sm font-medium text-ink">{event.title}</span>
                    <span className="block truncate text-label-md text-ink-faint">
                      {EVENT_KINDS[event.kind]} · {event.is_online ? 'En ligne' : event.location}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}
