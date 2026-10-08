'use client';

import { CalendarClock, CalendarDays, History, Megaphone, MonitorPlay, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useDebounced } from '@/shared/hooks';
import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button, CardSkeleton, EmptyState, ErrorNotice, SearchField, Segmented, Select, SideCard } from '@/shared/ui';

import { type EventFilters, type EventKind, EVENT_KINDS, useEventFacets, useEvents } from '../api';
import { EventCard } from './EventCard';
import { EventFormDialog } from './EventFormDialog';
import { RecentJobsCard } from './Widgets';

const chip = (active: boolean) =>
  cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-medium transition-colors',
    active ? 'bg-ink text-card' : 'bg-card text-ink-muted ring-1 ring-line ring-inset hover:text-ink hover:ring-line-strong',
  );

/** /events : meetups, hackathons et webinars tech en Afrique (ou en ligne). */
export function EventsScreen() {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [filters, setFilters] = useState<EventFilters>({});
  const [publishing, setPublishing] = useState(false);
  const q = useDebounced(query.trim(), 300);
  const events = useEvents({ ...filters, q: q || undefined, past: when === 'past' || undefined });
  const facets = useEventFacets();
  const set = (patch: Partial<EventFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const publish = () => (isAuthenticated ? setPublishing(true) : router.push('/login?next=/events'));

  return (
    <TwoColumns
      aside={
        <>
          <SideCard title="Vous organisez ?" icon={<Megaphone aria-hidden />}>
            <div className="space-y-3 px-4 pb-4">
              <p className="text-body-sm text-ink-muted">
                Meetup, hackathon ou webinar : annoncez-le à toute la communauté, c&apos;est gratuit.
              </p>
              <Button size="sm" variant="outline" className="w-full" onClick={publish}>
                <Plus className="size-4" aria-hidden /> Publier un événement
              </Button>
            </div>
          </SideCard>
          <RecentJobsCard />
        </>
      }
    >
      <PageHeader
        className="mb-2"
        icon={<CalendarDays aria-hidden />}
        title="Événements"
        description="Meetups, hackathons, webinars et conférences pour apprendre et rencontrer la communauté."
        actions={
          <Button onClick={publish}>
            <Plus className="size-4" aria-hidden /> Publier un événement
          </Button>
        }
      />
      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Titre, organisateur…"
        aria-label="Rechercher un événement"
        className="[&_input]:h-12 [&_input]:text-body-lg"
      />
      <Toolbar>
        <Segmented
          value={when}
          onChange={setWhen}
          options={[
            { value: 'upcoming', label: 'À venir', icon: <CalendarClock aria-hidden /> },
            { value: 'past', label: 'Passés', icon: <History aria-hidden /> },
          ]}
        />
        <Select
          aria-label="Pays"
          value={filters.country ?? ''}
          onChange={(e) => set({ country: e.target.value || undefined })}
          className="h-10 w-auto rounded-full shadow-none sm:ml-auto"
        >
          <option value="">Tous les pays</option>
          {facets.data?.countries.map((country) => (
            <option key={country.value} value={country.value}>
              {country.value} ({country.count})
            </option>
          ))}
        </Select>
      </Toolbar>
      <div className="scrollbar-none flex items-center gap-2 overflow-x-auto">
        <button type="button" aria-pressed={!filters.kind} onClick={() => set({ kind: undefined })} className={chip(!filters.kind)}>
          Tous les formats
        </button>
        {(Object.keys(EVENT_KINDS) as EventKind[]).map((kind) => (
          <button key={kind} type="button" aria-pressed={filters.kind === kind} onClick={() => set({ kind: filters.kind === kind ? undefined : kind })} className={chip(filters.kind === kind)}>
            {EVENT_KINDS[kind]}
          </button>
        ))}
        <span className="h-5 w-px shrink-0 bg-line" aria-hidden />
        <button type="button" aria-pressed={filters.online === true} onClick={() => set({ online: filters.online ? undefined : true })} className={chip(filters.online === true)}>
          <MonitorPlay className="size-3.5" aria-hidden /> En ligne
        </button>
      </div>

      {events.isPending ? (
        <div className="space-y-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : events.isError && !events.items.length ? (
        <ErrorNotice message="Les événements s'afficheront dès le retour du réseau." />
      ) : !events.items.length ? (
        <EmptyState icon={<CalendarDays aria-hidden />} title={when === 'past' ? 'Aucun événement passé' : 'Aucun événement à venir'}>
          Vous organisez un meetup ou un hackathon ? Annoncez-le à la communauté.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {events.items.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
      {events.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => events.fetchNextPage()} loading={events.isFetchingNextPage}>
          Voir plus d&apos;événements
        </Button>
      ) : null}
      <EventFormDialog open={publishing} onClose={() => setPublishing(false)} />
    </TwoColumns>
  );
}
