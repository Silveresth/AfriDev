'use client';

import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Code2,
  Download,
  FolderGit2,
  Github,
  Globe,
  Link2,
  MapPin,
  MessagesSquare,
  Newspaper,
  PartyPopper,
  Pencil,
  QrCode,
  RefreshCw,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import { AuthorPosts } from '@/features/feed';
import { OwnerProjects } from '@/features/projects';
import { AuthorQuestions } from '@/features/qa';
import { AuthorSnippets } from '@/features/snippets';
import { errorMessage } from '@/shared/api';
import { TwoColumns } from '@/shared/layout';
import { formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Avatar, Button, Card, CardSkeleton, ErrorNotice, profileColorHex, Segmented, SideCard, TechBadge, useToast } from '@/shared/ui';

import { type MyProfile, type PublicProfile, qrCodeUrl, useAiBio, usePublicProfile, useUpdateProfile } from '../api';
import { EditProfileDialog } from './EditProfileDialog';
import { BadgesCard, Endorsements, GitHubSection, OpenToWork, PinnedSection } from './ProSections';

type Tab = 'snippets' | 'posts' | 'questions' | 'projects';

const SINCE = new Intl.DateTimeFormat('fr', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('posts');
  const name = profile.display_name || profile.username;
  const accent = profileColorHex(profile.username, profile.accent_color);

  async function share() {
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) await navigator.share({ url, title: `${name} sur AfriDev Exchange` });
      else {
        await navigator.clipboard.writeText(url);
        toast('Lien du profil copié.');
      }
    } catch {
      // partage annulé
    }
  }

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

      <Card className="overflow-hidden">
        {/* Bannière : la couleur du membre, une trame de points discrète, rien d'autre. */}
        <div className="relative h-28 sm:h-36" style={{ backgroundColor: accent }} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1.2px)] bg-[length:14px_14px] [mask-image:linear-gradient(105deg,transparent_10%,black_75%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/15" />
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Avatar
              name={name}
              src={profile.avatar_url}
              color={accent}
              size={112}
              className="-mt-12 text-[2.25rem] ring-4 ring-card sm:-mt-14"
            />
            <div className="flex gap-2 pt-3">
              {me ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden /> Modifier le profil
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={share}>
                <Share2 className="size-4" aria-hidden /> Partager
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <h1 className="flex flex-wrap items-center gap-2 text-headline-xl text-ink">
              {name}
              {profile.badges?.slice(0, 2).map((badge) => (
                <TechBadge key={badge.code} label={badge.label} className="h-6 text-label-md" />
              ))}
            </h1>
            <p className="text-body-md text-ink-muted">
              @{profile.username}
              {profile.stack?.length ? (
                <>
                  <span className="mx-2 text-ink-faint" aria-hidden>
                    /
                  </span>
                  <span className="text-ink">Développeur·se {profile.stack.slice(0, 3).join(', ')}</span>
                </>
              ) : null}
            </p>
          </div>

          <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body-sm text-ink-muted">
            {profile.location ? (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-faint" aria-hidden /> {profile.location}
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-ink-faint" aria-hidden /> Membre depuis {SINCE.format(new Date(profile.created_at))}
            </li>
            {profile.github_username ? (
              <li>
                <a
                  href={`https://github.com/${profile.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-medium text-ink hover:underline"
                >
                  <Github className="size-4 text-ink-faint" aria-hidden /> {profile.github_username}
                </a>
              </li>
            ) : null}
            {profile.website ? (
              <li>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-1.5 font-medium text-ink hover:underline"
                >
                  <Link2 className="size-4 text-ink-faint" aria-hidden /> {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </li>
            ) : null}
          </ul>
          <OpenToWork profile={profile} />
        </div>

        {/* Chiffres clés de la réputation. */}
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4" title="+5 par vote reçu, +15 par réponse acceptée, +10 par snippet enregistré">
          {[
            { label: 'Karma', value: profile.karma_score ?? 0, strong: true },
            { label: 'Votes reçus', value: profile.karma_details?.upvotes ?? 0 },
            { label: 'Réponses acceptées', value: profile.karma_details?.accepted_answers ?? 0 },
            { label: 'Snippets enregistrés', value: profile.karma_details?.snippet_saves ?? 0 },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={`px-5 py-3.5 sm:px-6 ${index % 2 ? 'border-l border-line' : ''} ${index > 1 ? 'border-t border-line sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}
            >
              <dt className="text-label-md text-ink-faint">{stat.label}</dt>
              <dd className="text-headline-md text-ink tabular-nums" style={stat.strong ? { color: accent } : undefined}>
                {formatCount(Number(stat.value ?? 0))}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <PinnedSection profile={profile} me={me} />

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-headline-md text-ink">À propos</h2>
          {me ? <AiBioButton /> : null}
        </div>
        {profile.bio ? (
          <p className="max-w-prose text-body-lg whitespace-pre-line text-ink">{profile.bio}</p>
        ) : (
          <p className="text-body-md text-ink-muted">{me ? 'Ajoutez une bio ou laissez l’IA vous en proposer une.' : 'Pas encore de bio.'}</p>
        )}
        {me ? <AiBioSuggestion profile={me} /> : null}
        <Endorsements profile={profile} isMe={Boolean(me)} />
      </Card>

      <GitHubSection profile={profile} />
      <BadgesCard profile={profile} />

      <section aria-labelledby="activity" className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="activity" className="flex items-center gap-2 text-headline-md text-ink">
            <Activity className="size-5 text-ink-faint" aria-hidden /> Activité
          </h2>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'posts', label: 'Publications', icon: <Newspaper aria-hidden /> },
              { value: 'questions', label: 'Questions', icon: <MessagesSquare aria-hidden /> },
              { value: 'snippets', label: 'Snippets', icon: <Code2 aria-hidden /> },
              { value: 'projects', label: 'Projets', icon: <FolderGit2 aria-hidden /> },
            ]}
          />
        </div>
        {tab === 'snippets' ? <AuthorSnippets authorId={profile.id} /> : null}
        {tab === 'posts' ? <AuthorPosts authorId={profile.id} /> : null}
        {tab === 'questions' ? <AuthorQuestions authorId={profile.id} /> : null}
        {tab === 'projects' ? <OwnerProjects ownerId={profile.id} /> : null}
      </section>

      {me ? <EditProfileDialog profile={me} open={editing} onClose={() => setEditing(false)} /> : null}
    </TwoColumns>
  );
}

/** Mon profil uniquement : ce qu'il reste à renseigner pour un profil complet. */
function CompletionCard({ profile, onEdit }: { profile: MyProfile; onEdit: () => void }) {
  const steps = [
    { label: 'Nom affiché', done: Boolean(profile.display_name) },
    { label: 'Bio', done: Boolean(profile.bio) },
    { label: 'Stack technique', done: profile.stack.length > 0 },
    { label: 'Ville et pays', done: Boolean(profile.location) },
    { label: 'Compte GitHub', done: Boolean(profile.github_username) },
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
              {step.done ? (
                <Check className="size-4 text-secondary-ink" aria-hidden />
              ) : (
                <Circle className="size-4 text-ink-faint" aria-hidden />
              )}
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

function AiBioButton() {
  const aiBio = useAiBio();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="subtle" size="sm" onClick={() => aiBio.mutate()} loading={aiBio.isPending}>
        <Sparkles className="size-4 text-primary" aria-hidden /> Rédiger avec l&apos;IA
      </Button>
      {aiBio.isError ? <p className="text-body-sm text-danger">{errorMessage(aiBio.error)}</p> : null}
    </div>
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
