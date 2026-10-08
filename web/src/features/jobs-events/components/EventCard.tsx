'use client';

import { CalendarPlus, ExternalLink, MapPin, MonitorPlay, Trash2, UsersRound } from 'lucide-react';

import { useSession } from '@/shared/session';
import { buttonClasses, StatusBadge, Tag } from '@/shared/ui';

import { EVENT_KINDS, type TechEvent, useEventActions } from '../api';

const day = (date: string) => new Date(date).toLocaleDateString('fr', { day: '2-digit' });
const month = (date: string) => new Date(date).toLocaleDateString('fr', { month: 'short' }).replace('.', '');

export function eventWhen(event: Pick<TechEvent, 'starts_at' | 'ends_at'>) {
  const start = new Date(event.starts_at);
  const time = (date: Date) => date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
  const date = start.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!event.ends_at) return `${date} · ${time(start)}`;
  const end = new Date(event.ends_at);
  return start.toDateString() === end.toDateString()
    ? `${date} · ${time(start)} – ${time(end)}`
    : `${date} → ${end.toLocaleDateString('fr', { day: 'numeric', month: 'long' })}`;
}

/** Fichier .ics généré dans le navigateur : l'événement s'ajoute à l'agenda du téléphone. */
function downloadIcs(event: TechEvent) {
  const stamp = (date: string) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (text: string) => text.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const end = event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 2 * 3600_000).toISOString();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AfriDev Exchange//FR',
    'BEGIN:VEVENT',
    `UID:${event.id}@afridev.exchange`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    `LOCATION:${escape(event.is_online ? 'En ligne' : [event.location, event.country].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escape([event.description, event.registration_url].filter(Boolean).join('\n\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Carte d'événement : date en vignette, type, lieu ou « en ligne », organisateur, inscription. */
export function EventCard({ event }: { event: TechEvent }) {
  const { user } = useSession();
  const { remove } = useEventActions();
  const mine = Boolean(user && event.author?.id === user.id);
  const past = new Date(event.ends_at ?? event.starts_at) < new Date();

  return (
    <article className="flex gap-4 rounded-2xl border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised sm:p-5">
      <div className="flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-lg border border-line text-center" aria-hidden>
        <span className="w-full bg-primary py-0.5 text-label-sm font-semibold text-on-primary uppercase">{month(event.starts_at)}</span>
        <span className="py-1.5 text-headline-lg leading-none text-ink tabular-nums">{day(event.starts_at)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="primary" dot={false}>
            {EVENT_KINDS[event.kind]}
          </StatusBadge>
          {event.is_online ? (
            <StatusBadge tone="success" dot={false}>
              <MonitorPlay className="size-3" aria-hidden /> En ligne
            </StatusBadge>
          ) : null}
          {past ? <StatusBadge tone="neutral">Passé</StatusBadge> : null}
        </div>
        <h3 className="mt-1.5 text-body-lg font-semibold text-ink">{event.title}</h3>
        <p className="mt-0.5 text-body-sm text-ink-muted first-letter:uppercase">{eventWhen(event)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
          {!event.is_online ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {[event.location, event.country].filter(Boolean).join(', ')}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <UsersRound className="size-3.5" aria-hidden /> {event.organizer}
          </span>
        </p>
        {event.description ? <p className="mt-2 line-clamp-2 text-body-sm text-ink-muted">{event.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="-ml-1.5 flex flex-1 flex-wrap gap-0.5">
            {event.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </span>
          {mine ? (
            <button
              type="button"
              aria-label="Supprimer l'événement"
              onClick={() => window.confirm('Supprimer cet événement ?') && remove.mutate(event.id)}
              className="flex size-8 items-center justify-center rounded-lg text-ink-faint hover:bg-container hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
          {!past ? (
            <button type="button" onClick={() => downloadIcs(event)} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              <CalendarPlus className="size-3.5" aria-hidden /> Agenda
            </button>
          ) : null}
          {event.registration_url && !past ? (
            <a href={event.registration_url} target="_blank" rel="noopener noreferrer nofollow" className={buttonClasses({ size: 'sm' })}>
              S&apos;inscrire <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
