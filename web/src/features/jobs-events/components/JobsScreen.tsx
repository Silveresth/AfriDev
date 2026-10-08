'use client';

import { BriefcaseBusiness, Globe2, Megaphone, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useDebounced } from '@/shared/hooks';
import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button, CardSkeleton, EmptyState, ErrorNotice, SearchField, Select, SideCard } from '@/shared/ui';

import { type ContractType, CONTRACTS, type JobFilters, useJobFacets, useJobs } from '../api';
import { JobCard } from './JobCard';
import { JobFormDialog } from './JobFormDialog';
import { UpcomingEventsCard } from './Widgets';

const chip = (active: boolean) =>
  cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-medium transition-colors',
    active ? 'bg-ink text-card' : 'bg-card text-ink-muted ring-1 ring-line ring-inset hover:text-ink hover:ring-line-strong',
  );

/** /jobs : offres d'emploi et missions tech en Afrique, filtrables (télétravail, pays, techno). */
export function JobsScreen() {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<JobFilters>({});
  const [publishing, setPublishing] = useState(false);
  const q = useDebounced(query.trim(), 300);
  const jobs = useJobs({ ...filters, q: q || undefined });
  const facets = useJobFacets();
  const set = (patch: Partial<JobFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const active = Object.values(filters).some((value) => value !== undefined) || Boolean(q);
  const publish = () => (isAuthenticated ? setPublishing(true) : router.push('/login?next=/jobs'));

  return (
    <TwoColumns
      aside={
        <>
          <SideCard title="Vous recrutez ?" icon={<Megaphone aria-hidden />}>
            <div className="space-y-3 px-4 pb-4">
              <p className="text-body-sm text-ink-muted">
                Publiez gratuitement : l&apos;offre est vue par des développeurs qui ont déjà la bonne stack.
              </p>
              <Button size="sm" variant="outline" className="w-full" onClick={publish}>
                <Plus className="size-4" aria-hidden /> Publier une offre
              </Button>
            </div>
          </SideCard>
          <UpcomingEventsCard />
        </>
      }
    >
      <PageHeader
        className="mb-2"
        icon={<BriefcaseBusiness aria-hidden />}
        title="Job Board"
        description="CDI, missions freelance et stages pour les développeurs africains, sur place ou à distance."
        actions={
          <Button onClick={publish}>
            <Plus className="size-4" aria-hidden /> Publier une offre
          </Button>
        }
      />
      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Poste, entreprise, mot-clé…"
        aria-label="Rechercher une offre"
        className="[&_input]:h-12 [&_input]:text-body-lg"
      />
      <Toolbar>
        <Select
          aria-label="Pays"
          value={filters.country ?? ''}
          onChange={(e) => set({ country: e.target.value || undefined })}
          className="h-10 w-auto rounded-full shadow-none"
        >
          <option value="">Tous les pays</option>
          {facets.data?.countries.map((country) => (
            <option key={country.value} value={country.value}>
              {country.value} ({country.count})
            </option>
          ))}
        </Select>
        <Select
          aria-label="Contrat"
          value={filters.contract ?? ''}
          onChange={(e) => set({ contract: (e.target.value || undefined) as ContractType | undefined })}
          className="h-10 w-auto rounded-full shadow-none"
        >
          <option value="">Tous contrats</option>
          {Object.entries(CONTRACTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <button type="button" aria-pressed={filters.remote === true} onClick={() => set({ remote: filters.remote ? undefined : true })} className={cn(chip(filters.remote === true), 'h-10')}>
          <Globe2 className="size-3.5" aria-hidden /> Télétravail
        </button>
        {active ? (
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setQuery('');
            }}
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-1 px-2 text-body-sm font-medium text-ink-muted hover:text-ink"
          >
            <X className="size-3.5" aria-hidden /> Effacer les filtres
          </button>
        ) : null}
      </Toolbar>
      {facets.data?.technologies.length ? (
        <div className="scrollbar-none flex items-center gap-2 overflow-x-auto">
          {facets.data.technologies.slice(0, 12).map((tech) => (
            <button
              key={tech.value}
              type="button"
              aria-pressed={filters.tech === tech.value}
              onClick={() => set({ tech: filters.tech === tech.value ? undefined : tech.value })}
              className={chip(filters.tech === tech.value)}
            >
              {tech.value}
            </button>
          ))}
        </div>
      ) : null}

      {jobs.isPending ? (
        <div className="space-y-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : jobs.isError && !jobs.items.length ? (
        <ErrorNotice message="Les offres s'afficheront dès le retour du réseau." />
      ) : !jobs.items.length ? (
        <EmptyState icon={<BriefcaseBusiness aria-hidden />} title={active ? 'Aucune offre ne correspond' : 'Aucune offre pour le moment'}>
          {active ? 'Élargissez vos filtres.' : 'Vous recrutez ? Publiez la première offre, c’est gratuit.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {jobs.items.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
      {jobs.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => jobs.fetchNextPage()} loading={jobs.isFetchingNextPage}>
          Voir plus d&apos;offres
        </Button>
      ) : null}
      <JobFormDialog open={publishing} onClose={() => setPublishing(false)} />
    </TwoColumns>
  );
}
