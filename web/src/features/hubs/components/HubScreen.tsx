'use client';

import { Code2, MapPin, MessagesSquare, Newspaper, PenSquare, ScrollText, ShieldCheck, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { TwoColumns } from '@/shared/layout';
import { formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Avatar, buttonClasses, CardSkeleton, ErrorNotice, HubIcon, profileColorHex, SideCard, Tabs } from '@/shared/ui';

import { type Hub, useHub } from '../api';
import { memberLabel, VerifiedMark } from './HubCard';
import { JoinButton } from './JoinButton';

type Tab = 'posts' | 'questions' | 'snippets';

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
        ]}
      />
      {/* Les trois listes restent montées : changer d'onglet ne recharge rien. */}
      <div hidden={tab !== 'posts'}>{posts}</div>
      <div hidden={tab !== 'questions'}>{questions}</div>
      <div hidden={tab !== 'snippets'}>{snippets}</div>
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
      {hub.moderators.length ? (
        <SideCard title="Modération" icon={<ShieldCheck aria-hidden />}>
          <ul className="pb-2">
            {hub.moderators.map((moderator) => (
              <li key={moderator.id}>
                <Link href={`/u/${moderator.username}`} className="flex items-center gap-2.5 px-4 py-1.5 text-body-sm hover:bg-container-low">
                  <Avatar name={moderator.display_name} src={moderator.avatar_url} size={24} />
                  <span className="font-medium text-ink">{moderator.display_name}</span>
                  <span className="text-ink-faint">@{moderator.username}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SideCard>
      ) : null}
    </>
  );
}
