'use client';

import { Ban, Search, ShieldCheck, ShieldMinus, ShieldPlus, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useDebounced } from '@/shared/hooks';
import { PageHeader } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import {
  Avatar,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  Input,
  Segmented,
  StatusBadge,
  TimeAgo,
  useToast,
  Pagination,
} from '@/shared/ui';

import { type Member, type MemberFilters, useMembers, useUpdateMember } from '../api';

type Role = 'all' | 'staff' | 'suspended';

export function MembersScreen() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role>('all');
  const q = useDebounced(query.trim(), 400);
  const filters: MemberFilters = { q: q || undefined, role: role === 'all' ? undefined : role };
  const members = useMembers(filters);

  return (
    <>
      <PageHeader
        eyebrow="Back-office"
        title="Membres"
        description="Rechercher un compte, le suspendre en cas d'abus, ou gérer l'équipe de modération."
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pseudo, e-mail ou numéro de téléphone…"
            aria-label="Rechercher un membre"
            className="pl-9"
          />
        </div>
        <Segmented<Role>
          value={role}
          onChange={setRole}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'staff', label: 'Équipe' },
            { value: 'suspended', label: 'Suspendus' },
          ]}
        />
      </div>

      {members.isPending ? (
        <CardSkeleton lines={6} />
      ) : members.isError ? (
        <ErrorNotice title="Liste indisponible" message={errorMessage(members.error)} />
      ) : !members.items.length ? (
        <EmptyState icon={<Users className="size-8" aria-hidden />} title="Aucun membre trouvé">
          Essayez un autre pseudo, e-mail ou numéro.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          {/* Tableau sur grand écran (colonnes resserrées, jamais coupé), cartes sur petit écran. */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[26%]" />
              </colgroup>
              <thead className="border-b border-line bg-container-low text-label-md text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Membre</th>
                  <th className="px-4 py-3 font-medium">Activité</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.items.map((member) => (
                  <tr key={member.id} className={cn('align-top', !member.is_active && 'bg-danger-soft/20')}>
                    <td className="px-4 py-3">
                      <Identity member={member} />
                      <p className="mt-1 truncate pl-12 text-label-md text-ink-faint" title={[member.email, member.phone_number].filter(Boolean).join(' · ')}>
                        {[member.email, member.phone_number].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-ink-muted">
                      <span className="block">
                        Inscrit <TimeAgo date={member.date_joined} />
                      </span>
                      <span className="block text-label-md text-ink-faint">
                        {member.last_login ? (
                          <>
                            Vu <TimeAgo date={member.last_login} />
                          </>
                        ) : (
                          'Jamais connecté'
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badges member={member} />
                    </td>
                    <td className="px-4 py-3">
                      <Actions member={member} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line lg:hidden">
            {members.items.map((member) => (
              <li key={member.id} className={cn('space-y-3 p-4', !member.is_active && 'bg-danger-soft/20')}>
                <Identity member={member} />
                <p className="text-body-sm text-ink-muted">
                  {[member.email, member.phone_number].filter(Boolean).join(' · ') || '—'}
                </p>
                <Badges member={member} />
                <Actions member={member} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination
        page={members.page}
        hasPrevious={members.hasPrevious}
        hasNext={members.hasNext}
        onPrevious={members.goPrevious}
        onNext={members.goNext}
        loading={members.isFetching}
      />
    </>
  );
}

function Identity({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={member.display_name} src={member.avatar_url} size={36} />
      <div className="min-w-0">
        <Link href={`/u/${member.username}`} className="block truncate font-semibold text-ink hover:underline">
          {member.display_name}
        </Link>
        <span className="text-label-md text-ink-muted">@{member.username}</span>
      </div>
    </div>
  );
}

function Badges({ member }: { member: Member }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {member.is_superuser ? (
        <StatusBadge tone="primary" dot={false}><ShieldCheck className="size-3" aria-hidden /> Admin</StatusBadge>
      ) : member.is_staff ? (
        <StatusBadge tone="primary" dot={false}><ShieldCheck className="size-3" aria-hidden /> Modération</StatusBadge>
      ) : null}
      {member.is_active ? <StatusBadge tone="success">Actif</StatusBadge> : <StatusBadge tone="danger">Suspendu</StatusBadge>}
    </div>
  );
}

function Actions({ member }: { member: Member }) {
  const { user } = useSession();
  const toast = useToast();
  const update = useUpdateMember();
  if (!user || member.id === user.id) return <span className="text-label-md text-ink-faint">Vous</span>;
  const isTeam = member.is_staff || member.is_superuser;
  // Mêmes règles que le serveur : l'équipe n'est gérée que par un administrateur.
  if (isTeam && !user.is_superuser) return null;

  const run = (changes: { is_active?: boolean; is_staff?: boolean }, confirm: string, done: string) => {
    if (!window.confirm(confirm)) return;
    update.mutate(
      { id: member.id, changes },
      { onSuccess: () => toast(done), onError: (error) => toast(errorMessage(error), 'error') },
    );
  };

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {member.is_active ? (
        <Button
          variant="ghost"
          size="sm"
          loading={update.isPending}
          onClick={() =>
            run(
              { is_active: false },
              `Suspendre @${member.username} ? Ce compte ne pourra plus se connecter ni publier.`,
              'Compte suspendu.',
            )
          }
        >
          <Ban className="size-4" aria-hidden /> Suspendre
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          loading={update.isPending}
          onClick={() => run({ is_active: true }, `Réactiver @${member.username} ?`, 'Compte réactivé.')}
        >
          <UserCheck className="size-4" aria-hidden /> Réactiver
        </Button>
      )}
      {user.is_superuser && !member.is_superuser ? (
        member.is_staff ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run({ is_staff: false }, `Retirer @${member.username} de l'équipe ?`, "Retiré de l'équipe.")}
          >
            <ShieldMinus className="size-4" aria-hidden /> Retirer de l&apos;équipe
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              run(
                { is_staff: true },
                `Ajouter @${member.username} à l'équipe ? Ce membre aura accès au back-office et à la modération.`,
                "Ajouté à l'équipe.",
              )
            }
          >
            <ShieldPlus className="size-4" aria-hidden /> Ajouter à l&apos;équipe
          </Button>
        )
      ) : null}
    </div>
  );
}
