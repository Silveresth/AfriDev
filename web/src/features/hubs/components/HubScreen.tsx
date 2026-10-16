'use client';

import { Code2, MapPin, MessagesSquare, Newspaper, PenSquare, ScrollText, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { TwoColumns } from '@/shared/layout';
import { formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Avatar, buttonClasses, Button, CardSkeleton, ErrorNotice, HubIcon, profileColorHex, SideCard, Tabs } from '@/shared/ui';

import { type Hub, useAssignModerator, useHub, useRemoveModerator } from '../api';

import { memberLabel, VerifiedMark } from './HubCard';
import { HubMembers } from './HubMembers';
import { JoinButton } from './JoinButton';

type Tab = 'posts' | 'questions' | 'snippets' | 'members';

interface ExtendedHubViewer {
  is_member?: boolean;
  is_creator?: boolean;
  role?: string | null;
}

/**
 * Page d'un hub (/h/<slug>) : bannière, identité, Rejoindre, onglets de contenus.
 * Les listes viennent des features feed / qa / snippets (passées par la route).
 */
export function HubScreen({
  slug,
  initial,
  posts,
  questions,
  snippets,
}: {
  slug: string;
  initial?: Hub;
  posts: React.ReactNode;
  questions: React.ReactNode;
  snippets: React.ReactNode;
}) {
  const hub = useHub(slug, initial);
  const [tab, setTab] = useState<Tab>('posts');

  if (!hub.data) {
    return hub.isError ? (
      <div className="mx-auto max-w-3xl">
        <ErrorNotice title="Hub introuvable" message="Il a peut-être été supprimé, ou l'adresse est erronée." />
      </div>
    ) : (
      <div className="mx-auto max-w-3xl">
        <CardSkeleton lines={4} />
      </div>
    );
  }
  const data = hub.data;
  // Onglet « Membres » : créateur, modérateurs et staff seulement.
  const canManage = Boolean(data.viewer?.can_manage);

  return (
    <TwoColumns aside={<HubAside hub={data} />}>
      <HubHeader hub={data} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'posts', label: 'Discussions', icon: <Newspaper className="size-4" aria-hidden /> },
          { value: 'questions', label: 'Q&A', icon: <MessagesSquare className="size-4" aria-hidden /> },
          { value: 'snippets', label: 'Snippets', icon: <Code2 className="size-4" aria-hidden /> },
          ...(canManage ? [{ value: 'members' as const, label: 'Membres', icon: <UsersRound className="size-4" aria-hidden /> }] : []),
        ]}
      />
      {/* Les trois listes restent montées : changer d'onglet ne recharge rien. */}
      <div hidden={tab !== 'posts'}>{posts}</div>
      <div hidden={tab !== 'questions'}>{questions}</div>
      <div hidden={tab !== 'snippets'}>{snippets}</div>
      {canManage && tab === 'members' ? <HubMembers hub={data} /> : null}
    </TwoColumns>
  );
}

function HubHeader({ hub }: { hub: Hub }) {
  const { isAuthenticated } = useSession();
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      {hub.banner_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- bannière externe, masquée en mode texte seul
        <img src={hub.banner_url} alt="" data-media loading="lazy" className="h-24 w-full object-cover sm:h-32" />
      ) : (
        <div aria-hidden className="relative h-24 sm:h-28" style={{ backgroundColor: profileColorHex(hub.slug) }}>
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1.2px)] bg-[length:14px_14px] [mask-image:linear-gradient(105deg,transparent_10%,black_75%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/15" />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 pb-4 sm:px-5">
        <HubIcon icon={hub.icon} name={hub.name} size={76} className="-mt-9 rounded-xl border-4 border-card bg-card text-[2rem] shadow-card" />
        <div className="min-w-[12rem] flex-1">
          <h1 className="flex items-center gap-1.5 text-headline-lg text-ink">
            {hub.name}
            {hub.is_verified ? <VerifiedMark className="size-5 text-secondary" /> : null}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-ink-muted">
            <span>h/{hub.slug}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-3.5" aria-hidden /> {memberLabel(hub.member_count)}
            </span>
            {hub.target_country ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {hub.target_country}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          {isAuthenticated ? (
            <Link href={`/submit?hub=${hub.slug}`} className={buttonClasses({ variant: 'outline' })}>
              <PenSquare className="size-4" aria-hidden /> Créer un post
            </Link>
          ) : null}
          <JoinButton hub={hub} size="md" />
        </div>
      </div>
      {hub.description ? <p className="border-t border-line px-4 py-3 text-body-md text-ink-muted sm:px-5">{hub.description}</p> : null}
    </section>
  );
}

function HubAside({ hub }: { hub: Hub }) {
  const viewer = hub.viewer as ExtendedHubViewer | undefined;
  const isCreatorOrAdmin = Boolean(viewer?.is_creator);
  const [showAddMod, setShowAddMod] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const assignMod = useAssignModerator(hub.slug);
  const removeMod = useRemoveModerator(hub.slug);

  async function handleAddModerator(e: React.FormEvent) {
    e.preventDefault();
    const cleanUsername = usernameInput.trim().replace(/^@/, '');
    if (!cleanUsername) return;
    setErrorMsg(null);
    try {
      await assignMod.mutateAsync(cleanUsername);
      setUsernameInput('');
      setShowAddMod(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible d’ajouter ce modérateur.';
      setErrorMsg(message);
    }
  }

  async function handleRemoveModerator(username: string) {
    if (!confirm(`Voulez-vous révoquer les droits de modération de @${username} ?`)) return;
    try {
      await removeMod.mutateAsync(username);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la révocation.';
      alert(message);
    }
  }


  return (
    <>
      <SideCard title="À propos" icon={<UsersRound aria-hidden />}>
        <dl className="grid grid-cols-2 gap-3 px-4 pb-4">
          <div>
            <dt className="text-label-md text-ink-faint">Membres</dt>
            <dd className="text-headline-md text-ink tabular-nums">{formatCount(hub.member_count)}</dd>
          </div>
          <div>
            <dt className="text-label-md text-ink-faint">Créé le</dt>
            <dd className="text-body-md font-medium text-ink">
              {new Date(hub.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}
            </dd>
          </div>
        </dl>
      </SideCard>
      {hub.rules.length ? (
        <SideCard title="Règles du hub" icon={<ScrollText aria-hidden />}>
          <ol className="space-y-2.5 px-4 pb-4">
            {hub.rules.map((rule, index) => (
              <li key={rule} className="flex gap-3 text-body-sm text-ink">
                <span className="w-4 shrink-0 font-semibold text-ink-faint tabular-nums">{index + 1}</span>
                {rule}
              </li>
            ))}
          </ol>
        </SideCard>
      ) : null}
      <SideCard
        title="Modération"
        icon={<ShieldCheck aria-hidden />}
        action={
          isCreatorOrAdmin ? (
            <button
              type="button"
              onClick={() => setShowAddMod((v) => !v)}
              className="flex items-center gap-1 text-label-md font-medium text-primary-ink hover:underline"
            >
              <UserPlus className="size-3.5" aria-hidden />
              {showAddMod ? 'Annuler' : 'Ajouter'}
            </button>
          ) : null
        }
      >
        <div className="space-y-2 pb-2">
          {showAddMod ? (
            <form onSubmit={handleAddModerator} className="px-4 py-2 space-y-2 border-b border-line bg-container-low">
              <label htmlFor="mod-username" className="block text-label-md font-semibold text-ink">
                Nom d&apos;utilisateur
              </label>
              <div className="flex gap-2">
                <input
                  id="mod-username"
                  type="text"
                  placeholder="ex: amadou"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="h-8 flex-1 rounded-lg border border-line bg-card px-2.5 text-body-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
                />
                <Button size="sm" type="submit" loading={assignMod.isPending}>
                  Nommer
                </Button>
              </div>
              {errorMsg ? <p className="text-label-md text-danger">{errorMsg}</p> : null}
            </form>
          ) : null}

          {hub.moderators.length ? (
            <ul>
              {hub.moderators.map((moderator) => {
                const isCreator = moderator.id === hub.creator?.id;
                return (
                  <li key={moderator.id} className="flex items-center justify-between px-4 py-1.5 hover:bg-container-low">
                    <Link href={`/u/${moderator.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-body-sm">
                      <Avatar name={moderator.display_name} src={moderator.avatar_url} size={24} />
                      <span className="truncate font-medium text-ink">{moderator.display_name}</span>
                      <span className="text-label-md text-ink-faint">@{moderator.username}</span>
                    </Link>
                    {isCreator ? (
                      <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary-ink">
                        Créateur
                      </span>
                    ) : isCreatorOrAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveModerator(moderator.username)}
                        disabled={removeMod.isPending}
                        title="Révoquer ce modérateur"
                        className="ml-2 text-ink-faint hover:text-danger disabled:opacity-50"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-2 text-label-md text-ink-faint">Aucun modérateur pour l&apos;instant.</p>
          )}
        </div>
      </SideCard>
    </>
  );
}

