'use client';

import type { Schemas } from '@afridev/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, ChevronRight, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useFollow } from '@/features/profile';
import { api, unwrap } from '@/shared/api';
import { formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Avatar, Button, CardSkeleton, EmptyState } from '@/shared/ui';

type Person = Schemas['PeopleSearchItem'];

export function usePeopleSearch(q: string, limit: number) {
  return useQuery({
    queryKey: ['people-search', q, limit],
    queryFn: () => unwrap(api.GET('/api/profiles/search/', { params: { query: { q, limit } } })),
    enabled: q.trim().length >= 1,
    meta: { persist: false },
  });
}

/** Comptes trouvés (comme TikTok / X) : photo, nom, @pseudo, abonnés et bouton S'abonner. */
export function PeopleResults({ q, compact = false, onSeeAll }: { q: string; compact?: boolean; onSeeAll?: () => void }) {
  const people = usePeopleSearch(q, compact ? 3 : 30);
  if (people.isPending) return compact ? null : <CardSkeleton lines={3} />;
  const rows = people.data ?? [];
  if (!rows.length) {
    return compact ? null : (
      <EmptyState icon={<UserRound aria-hidden />} title="Aucun compte">
        Aucun membre ne correspond à « {q} ». Essayez son pseudo ou son nom.
      </EmptyState>
    );
  }
  return (
    <section aria-label="Comptes" className="space-y-2">
      {compact ? (
        <div className="flex items-center justify-between px-1">
          <p className="text-body-sm font-semibold text-ink">Comptes</p>
          {onSeeAll ? (
            <button type="button" onClick={onSeeAll} className="flex items-center gap-0.5 text-body-sm font-semibold text-primary-ink hover:underline">
              Voir tous les comptes <ChevronRight className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        {rows.map((person) => (
          <li key={person.id}>
            <PersonRow person={person} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonRow({ person }: { person: Person }) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const follow = useFollow(person.username);
  const toggle = () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/u/${person.username}`)}`);
      return;
    }
    follow.mutate(!person.is_following, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['people-search'] }),
    });
  };
  return (
    <div className="flex items-center gap-3 p-3.5 sm:px-4">
      <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
        <Avatar name={person.display_name} src={person.avatar_url} size={52} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink">{person.display_name}</span>
            {person.open_to_work ? (
              <BriefcaseBusiness className="size-3.5 shrink-0 text-secondary" aria-label="Ouvert aux opportunités" />
            ) : null}
          </span>
          <span className="block truncate text-body-sm text-ink-muted">
            @{person.username} · {formatCount(person.followers_count)} abonné{person.followers_count > 1 ? 's' : ''}
          </span>
          {person.bio ? <span className="line-clamp-1 block text-body-sm text-ink-faint">{person.bio}</span> : null}
        </span>
      </Link>
      {person.is_me ? null : (
        <Button size="sm" variant={person.is_following ? 'outline' : 'primary'} loading={follow.isPending} onClick={toggle}>
          {person.is_following ? 'Abonné' : "S'abonner"}
        </Button>
      )}
    </div>
  );
}
