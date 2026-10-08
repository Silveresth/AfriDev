'use client';

import { Clock, Flame, Plus, UserRoundCheck, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useDebounced } from '@/shared/hooks';
import { PageContainer, PageHeader, Toolbar } from '@/shared/layout';
import { useSession } from '@/shared/session';
import { Button, CardSkeleton, EmptyState, ErrorNotice, SearchField, Segmented } from '@/shared/ui';

import { type HubFilters, useHubs } from '../api';
import { CreateHubDialog } from './CreateHubDialog';
import { HubCard } from './HubCard';

type View = 'popular' | 'new' | 'mine';

/** /hubs : explorer les communautés, rejoindre, créer la sienne. */
export function HubsScreen() {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const [view, setView] = useState<View>('popular');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useDebounced(query.trim(), 300);
  const filters: HubFilters = view === 'mine' ? { mine: true, q: q || undefined } : { sort: view, q: q || undefined };
  const hubs = useHubs(filters, { enabled: view !== 'mine' || isAuthenticated });

  return (
    <PageContainer>
      <PageHeader
        icon={<UsersRound aria-hidden />}
        title="Hubs"
        description="Des communautés autonomes par techno, par pays ou par passion : rejoignez celles qui vous ressemblent."
        actions={
          <Button onClick={() => (isAuthenticated ? setCreating(true) : router.push('/login?next=/hubs'))}>
            <Plus className="size-4" aria-hidden /> Créer un hub
          </Button>
        }
      />
      <Toolbar className="mb-4">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'popular', label: 'Populaires', icon: <Flame aria-hidden /> },
            { value: 'new', label: 'Récents', icon: <Clock aria-hidden /> },
            ...(isAuthenticated ? [{ value: 'mine' as const, label: 'Mes hubs', icon: <UserRoundCheck aria-hidden /> }] : []),
          ]}
        />
        <SearchField
          className="w-full sm:ml-auto sm:w-72"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un hub…"
          aria-label="Rechercher un hub"
        />
      </Toolbar>

      {hubs.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      ) : hubs.isError && !hubs.items.length ? (
        <ErrorNotice message="Les hubs s'afficheront dès le retour du réseau." />
      ) : !hubs.items.length ? (
        <EmptyState
          icon={<UsersRound aria-hidden />}
          title={view === 'mine' ? "Vous n'avez rejoint aucun hub" : 'Aucun hub trouvé'}
          action={
            isAuthenticated ? (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden /> Créer le premier
              </Button>
            ) : undefined
          }
        >
          {view === 'mine' ? 'Explorez les hubs populaires et rejoignez-en un en un clic.' : 'Essayez un autre mot-clé, ou lancez le vôtre.'}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.items.map((hub) => (
            <HubCard key={hub.id} hub={hub} />
          ))}
        </div>
      )}
      {hubs.hasNextPage ? (
        <Button variant="outline" className="mt-4 w-full" onClick={() => hubs.fetchNextPage()} loading={hubs.isFetchingNextPage}>
          Voir plus de hubs
        </Button>
      ) : null}
      <CreateHubDialog open={creating} onClose={() => setCreating(false)} />
    </PageContainer>
  );
}
