'use client';

import {
  Check,
  CheckCircle2,
  Circle,
  Clapperboard,
  Code2,
  Download,
  FolderGit2,
  Globe,
  HandHelping,
  LayoutGrid,
  Newspaper,
  PartyPopper,
  Pencil,
  QrCode,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import { AuthorPosts, AuthorVideos } from '@/features/feed';
import { OwnerProjects } from '@/features/projects';
import { AuthorHelp } from '@/features/qa';
import { AuthorSnippets } from '@/features/snippets';
import { errorMessage } from '@/shared/api';
import { TwoColumns } from '@/shared/layout';
import { useSession } from '@/shared/session';
import { Button, Card, CardSkeleton, ErrorNotice, FilterChips, profileColorHex, SideCard, Tabs } from '@/shared/ui';

import { type MyProfile, type PublicProfile, qrCodeUrl, useAiBio, usePublicProfile, useUpdateProfile } from '../api';
import { CraftTab } from './CraftTab';
import { EditProfileDialog } from './EditProfileDialog';
import { ProfileHeader } from './ProfileHeader';
import { PinnedSection } from './ProSections';

type Tab = 'creations' | 'videos' | 'help' | 'craft';
type Creation = 'posts' | 'snippets' | 'projects';

export function ProfileScreen({ username, initial, welcome = false }: { username: string; initial?: PublicProfile; welcome?: boolean }) {
  const publicProfile = usePublicProfile(username, initial);
  const { profile: me } = useSession();
  const isMe = Boolean(me && me.username.toLowerCase() === username.toLowerCase());
  // Pour son propre profil, la version complète (suggestion IA) et toujours à jour.
  const profile: PublicProfile | MyProfile | undefined = isMe ? me : publicProfile.data;

  if (!profile) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {publicProfile.isError ? (
          <ErrorNotice title="Profil introuvable" message={`Aucun membre ne s'appelle @${username}.`} />
        ) : (
          <CardSkeleton lines={5} />
        )}
      </div>
    );
  }
  return <ProfileView profile={profile} me={isMe ? me : undefined} welcome={welcome && isMe} />;
}

function ProfileView({ profile, me, welcome }: { profile: PublicProfile; me?: MyProfile; welcome: boolean }) {
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('creations');
  const name = profile.display_name || profile.username;
  const accent = profileColorHex(profile.username, profile.accent_color);

  return (
    <TwoColumns
      aside={
        <>
          {me ? <CompletionCard profile={me} onEdit={() => setEditing(true)} /> : null}
          <QrCard profile={profile} name={name} />
        </>
      }
    >
      {welcome ? (
        <Card className="flex flex-wrap items-center gap-3 border-secondary/30 bg-secondary-soft/50 p-4">
          <PartyPopper className="size-5 text-secondary-ink" aria-hidden />
          <p className="flex-1 text-body-md text-ink">Bienvenue sur AfriDev ! Complétez votre stack pour recevoir des projets adaptés.</p>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Compléter mon profil
          </Button>
        </Card>
      ) : null}

      <ProfileHeader profile={profile} isMe={Boolean(me)} accent={accent} onEdit={() => setEditing(true)} />

      {me ? <AiBioCard profile={me} /> : null}

      <section aria-label="Contenus du profil" className="space-y-4">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          className="sticky top-16 z-10 -mx-1 bg-surface/90 px-1 backdrop-blur-md"
          options={[
            { value: 'creations', label: 'Snippets & Posts', icon: <LayoutGrid className="size-4" aria-hidden /> },
            { value: 'videos', label: 'Vidéos & Tutos', icon: <Clapperboard className="size-4" aria-hidden /> },
            { value: 'help', label: 'Q&A & Entraide', icon: <HandHelping className="size-4" aria-hidden /> },
            { value: 'craft', label: 'Craft & Stack', icon: <Sparkles className="size-4" aria-hidden /> },
          ]}
        />
        {tab === 'creations' ? <CreationsTab profile={profile} me={me} /> : null}
        {tab === 'videos' ? <AuthorVideos authorId={profile.id} /> : null}
        {tab === 'help' ? <AuthorHelp authorId={profile.id} /> : null}
        {tab === 'craft' ? <CraftTab profile={profile} isMe={Boolean(me)} accent={accent} /> : null}
      </section>

      {me ? <EditProfileDialog profile={me} open={editing} onClose={() => setEditing(false)} /> : null}
    </TwoColumns>
  );
}

/** Onglet 1 : épinglés, puis publications, snippets ou projets. */
function CreationsTab({ profile, me }: { profile: PublicProfile; me?: MyProfile }) {
  const [view, setView] = useState<Creation>('posts');
  return (
    <div className="space-y-4">
      <PinnedSection profile={profile} me={me} />
      <FilterChips<Creation>
        value={view}
        onChange={setView}
        options={[
          { value: 'posts', label: 'Publications', icon: <Newspaper className="size-4" aria-hidden /> },
          { value: 'snippets', label: 'Snippets', icon: <Code2 className="size-4" aria-hidden /> },
          { value: 'projects', label: 'Projets', icon: <FolderGit2 className="size-4" aria-hidden /> },
        ]}
      />
      {view === 'posts' ? <AuthorPosts authorId={profile.id} /> : null}
      {view === 'snippets' ? <AuthorSnippets authorId={profile.id} /> : null}
      {view === 'projects' ? <OwnerProjects ownerId={profile.id} /> : null}
    </div>
  );
}

/** Mon profil uniquement : ce qu'il reste à renseigner pour un profil complet. */
function CompletionCard({ profile, onEdit }: { profile: MyProfile; onEdit: () => void }) {
  const steps = [
    { label: 'Photo de profil', done: Boolean(profile.avatar_url) },
    { label: 'Bannière', done: Boolean(profile.banner_url) },
    { label: 'Bio', done: Boolean(profile.bio) },
    { label: 'Stack technique', done: profile.stack.length > 0 },
    { label: 'Ville et pays', done: Boolean(profile.location) },
    { label: 'Réseaux sociaux', done: Object.keys(profile.social_links ?? {}).length > 0 },
    { label: 'Contenus épinglés', done: profile.pinned.length > 0 },
  ];
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const ratio = Math.round((done / steps.length) * 100);
  return (
    <SideCard title="Profil complété" icon={<CheckCircle2 aria-hidden />} action={<span className="text-label-md font-semibold text-ink tabular-nums">{ratio} %</span>}>
      <div className="space-y-3 px-4 pb-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-container-high" aria-hidden>
          <div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${ratio}%` }} />
        </div>
        <ul className="space-y-1.5">
          {steps.map((step) => (
            <li key={step.label} className={`flex items-center gap-2 text-body-sm ${step.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
              {step.done ? <Check className="size-4 text-secondary-ink" aria-hidden /> : <Circle className="size-4 text-ink-faint" aria-hidden />}
              {step.label}
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" className="w-full" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> Compléter
        </Button>
      </div>
    </SideCard>
  );
}

function QrCard({ profile, name }: { profile: PublicProfile; name: string }) {
  return (
    <SideCard title="Carte développeur" icon={<QrCode aria-hidden />}>
      <div className="space-y-3 px-4 pb-4">
        <p className="text-body-sm text-ink-muted">Scannez-la pour ouvrir ce profil, en meetup ou en hackathon.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG de quelques Ko servi par l'API */}
        <img
          src={qrCodeUrl(profile.username)}
          alt={`QR code du profil de ${name}`}
          width={160}
          height={160}
          className="mx-auto rounded-xl bg-white p-2 ring-1 ring-line"
        />
        <p className="flex items-center justify-center gap-1.5 text-label-md text-ink-faint">
          <Globe className="size-3.5" aria-hidden /> afridev/u/{profile.username}
        </p>
        <a
          href={qrCodeUrl(profile.username)}
          download={`afridev-${profile.username}.svg`}
          className="flex h-9 items-center justify-center gap-2 rounded-lg border border-line text-body-sm font-medium text-ink transition-colors hover:bg-container-low"
        >
          <Download className="size-4" aria-hidden /> Télécharger le QR code
        </a>
      </div>
    </SideCard>
  );
}

/** Mon profil : rédaction de la bio par l'IA (la bio elle-même s'affiche dans l'en-tête). */
function AiBioCard({ profile }: { profile: MyProfile }) {
  const aiBio = useAiBio();
  const hasSuggestion = profile.ai_bio_status === 'ready' && profile.ai_bio_suggestion && profile.ai_bio_suggestion !== profile.bio;
  if (profile.bio && !hasSuggestion && profile.ai_bio_status !== 'failed') return null;
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-md text-ink-muted">{profile.bio ? 'Une nouvelle bio vous attend.' : 'Pas encore de bio : laissez l’IA vous en proposer une.'}</p>
        <Button variant="subtle" size="sm" onClick={() => aiBio.mutate()} loading={aiBio.isPending}>
          <Sparkles className="size-4 text-primary" aria-hidden /> Rédiger avec l&apos;IA
        </Button>
      </div>
      {aiBio.isError ? <p className="text-body-sm text-danger">{errorMessage(aiBio.error)}</p> : null}
      <AiBioSuggestion profile={profile} />
    </Card>
  );
}

function AiBioSuggestion({ profile }: { profile: MyProfile }) {
  const update = useUpdateProfile();
  const aiBio = useAiBio();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const suggestion = profile.ai_bio_suggestion;
  if (profile.ai_bio_status === 'failed') {
    return <p className="text-body-sm text-danger">La bio IA n&apos;a pas pu être générée. Réessayez plus tard.</p>;
  }
  if (profile.ai_bio_status !== 'ready' || !suggestion || suggestion === profile.bio || dismissed === suggestion) return null;
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary-soft/40 p-4">
      <p className="flex items-center gap-2 text-body-sm font-semibold text-primary-ink">
        <Sparkles className="size-4" aria-hidden /> Bio proposée par l&apos;IA
      </p>
      <p className="text-body-md text-ink">{suggestion}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => update.mutate({ bio: suggestion })} loading={update.isPending}>
          <Check className="size-4" aria-hidden /> Utiliser cette bio
        </Button>
        <Button size="sm" variant="ghost" onClick={() => aiBio.mutate()} loading={aiBio.isPending}>
          <RefreshCw className="size-4" aria-hidden /> Une autre
        </Button>
        <Button size="sm" variant="plain" onClick={() => setDismissed(suggestion)}>
          Ignorer
        </Button>
      </div>
    </div>
  );
}
