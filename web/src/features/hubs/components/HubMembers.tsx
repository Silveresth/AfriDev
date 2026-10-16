'use client';

import { Ban, Crown, Ellipsis, Search, ShieldCheck, ShieldOff, UserMinus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Avatar, Button, Card, CardHeader, EmptyState, Menu, MenuItem, MenuSeparator, Segmented, Skeleton, TimeAgo, useToast } from '@/shared/ui';

import {
  type Hub,
  type HubMember,
  useAssignModerator,
  useHubBans,
  useHubMembers,
  useLiftBan,
  useRemoveMember,
  useRemoveModerator,
} from '../api';

type RoleFilter = 'all' | 'moderator';

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Gestion des membres d'un hub (créateur, modérateurs, staff) : recherche, rôles, retrait et
 * exclusion ; nommer / révoquer un modérateur est réservé au créateur.
 */
export function HubMembers({ hub }: { hub: Hub }) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const q = useDebounced(search.trim());
  const members = useHubMembers(hub.slug, { q: q || undefined, role: role === 'all' ? undefined : role });
  const bans = useHubBans(hub.slug);

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <CardHeader
          icon={<Users className="size-4" />}
          title="Membres"
          subtitle={`${hub.member_count} membre${hub.member_count > 1 ? 's' : ''} · visible seulement par la modération`}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher un membre</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par pseudo…"
              className="h-9 w-full rounded-lg border border-line bg-card pr-3 pl-9 text-body-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
          </label>
          <Segmented<RoleFilter>
            value={role}
            onChange={setRole}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'moderator', label: 'Modérateurs' },
            ]}
          />
        </div>

        {members.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : members.items.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {members.items.map((member) => (
              <MemberRow key={member.user.id} hub={hub} member={member} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Users aria-hidden />} title={q ? `Aucun membre ne correspond à « ${q} »` : 'Aucun membre'} />
        )}
        {members.hasNextPage ? (
          <Button variant="outline" className="w-full" onClick={() => members.fetchNextPage()} loading={members.isFetchingNextPage}>
            Voir plus
          </Button>
        ) : null}
      </Card>

      {bans.items.length ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <CardHeader icon={<Ban className="size-4" />} title="Membres exclus" subtitle="Ils ne peuvent ni rejoindre le hub ni y publier." />
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {bans.items.map((ban) => (
              <BanRow key={ban.user.id} slug={hub.slug} username={ban.user.username} name={ban.user.display_name} avatar={ban.user.avatar_url} reason={ban.reason} at={ban.banned_at} />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function MemberRow({ hub, member }: { hub: Hub; member: HubMember }) {
  const { user } = useSession();
  const toast = useToast();
  const remove = useRemoveMember(hub.slug);
  const promote = useAssignModerator(hub.slug);
  const demote = useRemoveModerator(hub.slug);
  const viewerIsCreator = Boolean(hub.viewer?.is_creator);
  const isSelf = member.user.id === user?.id;
  const isModerator = member.role === 'moderator';
  // Le créateur n'est jamais géré ; un modérateur ne l'est que par le créateur.
  const manageable = !member.is_creator && !isSelf && (!isModerator || viewerIsCreator);
  const name = member.user.display_name || member.user.username;

  const run = (promise: Promise<unknown>, done: string) =>
    promise.then(() => toast(done)).catch((error: unknown) => toast(errorMessage(error), 'error'));

  return (
    <li className="flex items-center gap-3 bg-card px-3.5 py-2.5">
      <Link href={`/u/${member.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={name} src={member.user.avatar_url} size={34} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-body-sm font-semibold text-ink">{name}</span>
            {member.is_creator ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary-ink">
                <Crown className="size-3" aria-hidden /> Créateur
              </span>
            ) : isModerator ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-on-secondary-soft">
                <ShieldCheck className="size-3" aria-hidden /> Modérateur
              </span>
            ) : null}
          </span>
          <span className="block truncate text-label-md text-ink-faint">
            @{member.user.username} · membre depuis <TimeAgo date={member.joined_at} />
          </span>
        </span>
      </Link>
      {manageable ? (
        <Menu
          className="w-56"
          trigger={(props) => (
            <button
              type="button"
              aria-label={`Gérer @${member.user.username}`}
              {...props}
              className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-container hover:text-ink')}
            >
              <Ellipsis className="size-4" aria-hidden />
            </button>
          )}
        >
          {viewerIsCreator ? (
            isModerator ? (
              <MenuItem onSelect={() => void run(demote.mutateAsync(member.user.username), `@${member.user.username} n'est plus modérateur.`)}>
                <ShieldOff aria-hidden /> Retirer le rôle de modérateur
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => void run(promote.mutateAsync(member.user.username), `@${member.user.username} est maintenant modérateur.`)}>
                <ShieldCheck aria-hidden /> Nommer modérateur
              </MenuItem>
            )
          ) : null}
          {viewerIsCreator ? <MenuSeparator /> : null}
          <MenuItem
            onSelect={() => {
              if (!window.confirm(`Retirer @${member.user.username} du hub ? Il pourra le rejoindre à nouveau.`)) return;
              void run(remove.mutateAsync({ username: member.user.username }), `@${member.user.username} a été retiré du hub.`);
            }}
          >
            <UserMinus aria-hidden /> Retirer du hub
          </MenuItem>
          <MenuItem
            danger
            onSelect={() => {
              const reason = window.prompt(
                `Exclure @${member.user.username} ? Il ne pourra plus rejoindre le hub ni y publier.\n\nMotif (facultatif) :`,
              );
              if (reason === null) return;
              void run(remove.mutateAsync({ username: member.user.username, ban: true, reason }), `@${member.user.username} est exclu du hub.`);
            }}
          >
            <Ban aria-hidden /> Exclure du hub
          </MenuItem>
        </Menu>
      ) : null}
    </li>
  );
}

function BanRow({ slug, username, name, avatar, reason, at }: { slug: string; username: string; name: string; avatar?: string | null; reason: string; at: string }) {
  const lift = useLiftBan(slug);
  const toast = useToast();
  return (
    <li className="flex items-center gap-3 bg-card px-3.5 py-2.5">
      <Avatar name={name || username} src={avatar} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-ink">{name || username}</span>
        <span className="block truncate text-label-md text-ink-faint">
          @{username} · exclu <TimeAgo date={at} />
          {reason ? ` · ${reason}` : ''}
        </span>
      </span>
      <Button
        variant="outline"
        size="sm"
        loading={lift.isPending}
        onClick={() =>
          lift.mutate(username, {
            onSuccess: () => toast(`Exclusion de @${username} levée.`),
            onError: (error) => toast(errorMessage(error), 'error'),
          })
        }
      >
        Lever l&apos;exclusion
      </Button>
    </li>
  );
}
