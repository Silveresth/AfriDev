'use client';

import {
  Award,
  BriefcaseBusiness,
  Check,
  Code2,
  FolderGit2,
  Github,
  MessagesSquare,
  Newspaper,
  Pin,
  Plus,
  Star,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn, formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Avatar, Button, Card, Dialog, languageColor, Skeleton, useToast } from '@/shared/ui';

import {
  type MyProfile,
  type PinTargetType,
  type PublicProfile,
  usePinCandidates,
  useEndorse,
  useEndorsements,
  useGitHubOverview,
  useSetPinned,
  WORK_PREFERENCES,
  type WorkPreference,
} from '../api';

const PIN_ICONS = { post: Newspaper, question: MessagesSquare, snippet: Code2, project: FolderGit2 };
const PIN_LABELS = { post: 'Post', question: 'Question', snippet: 'Snippet', project: 'Projet' };

/** Badges obtenus automatiquement (les chiffres de réputation sont dans l'en-tête du profil). */
export function BadgesCard({ profile }: { profile: PublicProfile }) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-headline-md text-ink">
          <Award className="size-5 text-ink-faint" aria-hidden /> Badges
        </h2>
        <p className="text-body-sm text-ink-muted">Décernés automatiquement par la communauté, au fil des contributions.</p>
      </div>
      {profile.badges?.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {profile.badges.map((badge) => (
            <li key={badge.code} className="flex items-start gap-3 rounded-xl border border-line bg-container-low/60 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tertiary-soft text-on-tertiary-soft ring-1 ring-tertiary/20">
                <Award className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-ink">{badge.label}</span>
                <span className="block text-label-md text-ink-muted">{badge.description}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            ['Expert Python', '3 réponses acceptées sur un même sujet'],
            ['Contributeur majeur', '250 points de karma'],
            ['Top 5 % Entraide', 'Parmi les membres qui aident le plus'],
          ].map(([label, rule]) => (
            <li key={label} className="rounded-xl border border-dashed border-line-strong p-3">
              <span className="flex items-center gap-1.5 text-body-sm font-medium text-ink-muted">
                <Award className="size-4 text-ink-faint" aria-hidden /> {label}
              </span>
              <span className="mt-0.5 block text-label-md text-ink-faint">{rule}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Badge « Open to Work » détaillé : formes de collaboration, TJM, disponibilité. */
export function OpenToWork({ profile }: { profile: PublicProfile }) {
  if (!profile.open_to_work) return null;
  const preferences = profile.work_preferences.filter((code): code is WorkPreference => code in WORK_PREFERENCES);
  return (
    <div className="mt-4 rounded-xl border border-secondary/25 bg-secondary-soft/40 p-3.5">
      <p className="flex items-center gap-2 text-body-sm font-semibold text-on-secondary-soft">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-secondary opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-secondary" />
        </span>
        Open to Work
        {profile.daily_rate ? <span className="font-normal text-on-secondary-soft/80">· {profile.daily_rate}</span> : null}
      </p>
      {preferences.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {preferences.map((code) => (
            <span key={code} className="inline-flex h-6 items-center gap-1 rounded-full border border-secondary/25 bg-card px-2.5 text-label-md font-medium text-ink">
              <BriefcaseBusiness className="size-3 text-secondary-ink" aria-hidden /> {WORK_PREFERENCES[code]}
            </span>
          ))}
        </div>
      ) : null}
      {profile.availability_note ? <p className="mt-2 text-body-sm text-on-secondary-soft">{profile.availability_note}</p> : null}
    </div>
  );
}

/** « Épinglés » : 3 contenus mis en avant en tête du profil. */
export function PinnedSection({ profile, me }: { profile: PublicProfile; me?: MyProfile }) {
  const [managing, setManaging] = useState(false);
  if (!profile.pinned.length && !me) return null;
  return (
    <section aria-labelledby="pinned" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="pinned" className="flex items-center gap-2 text-headline-md text-ink">
          <Pin className="size-4 text-ink-faint" aria-hidden /> Épinglés
        </h2>
        {me ? (
          <Button variant="plain" size="sm" onClick={() => setManaging(true)}>
            Gérer
          </Button>
        ) : null}
      </div>
      {profile.pinned.length ? (
        <ul className="grid gap-3 sm:grid-cols-3">
          {profile.pinned.map((item) => {
            const Icon = PIN_ICONS[item.target_type];
            return (
              <li key={`${item.target_type}-${item.target_id}`}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised"
                >
                  <span className="flex items-center gap-1.5 text-label-md text-ink-faint">
                    <Icon className="size-3.5" aria-hidden /> {PIN_LABELS[item.target_type]}
                    {item.language ? (
                      <>
                        <span className="size-2 rounded-full" style={{ backgroundColor: languageColor(item.language) }} aria-hidden />
                        {item.language}
                      </>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-body-sm font-semibold text-ink">{item.title}</span>
                  {item.excerpt ? <span className="line-clamp-2 text-label-md text-ink-muted">{item.excerpt}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-5 text-body-sm text-ink-muted transition-colors hover:bg-card"
        >
          <Plus className="size-4" aria-hidden /> Épinglez jusqu&apos;à 3 contenus : vos meilleurs snippets, projets ou retours d&apos;expérience.
        </button>
      )}
      {me && managing ? <PinDialog me={me} onClose={() => setManaging(false)} /> : null}
    </section>
  );
}

function PinDialog({ me, onClose }: { me: MyProfile; onClose: () => void }) {
  const candidates = usePinCandidates(me.id, true);
  const setPinned = useSetPinned();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(me.pinned.map((item) => `${item.target_type}:${item.target_id}`));

  function toggle(key: string) {
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : current.length >= 3 ? current : [...current, key]));
  }

  async function save() {
    try {
      await setPinned.mutateAsync(
        selected.map((key) => {
          const [target_type, target_id] = key.split(':') as [PinTargetType, string];
          return { target_type, target_id };
        }),
      );
      toast('Épinglés mis à jour.');
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Contenus épinglés">
      <p className="-mt-1 mb-3 text-body-sm text-ink-muted">Choisissez jusqu&apos;à 3 contenus publics, dans l&apos;ordre d&apos;affichage.</p>
      {candidates.isPending ? (
        <Skeleton className="h-40" />
      ) : candidates.data?.length ? (
        <ul className="-mx-1 max-h-80 space-y-0.5 overflow-y-auto">
          {candidates.data.map((item) => {
            const key = `${item.target_type}:${item.target_id}`;
            const position = selected.indexOf(key);
            const Icon = PIN_ICONS[item.target_type];
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={position >= 0}
                  disabled={position < 0 && selected.length >= 3}
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-container disabled:opacity-50"
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border text-label-sm font-bold',
                      position >= 0 ? 'border-primary bg-primary text-on-primary' : 'border-line-strong',
                    )}
                    aria-hidden
                  >
                    {position >= 0 ? position + 1 : null}
                  </span>
                  <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{item.title}</span>
                  <span className="text-label-md text-ink-faint">{PIN_LABELS[item.target_type]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-4 text-body-sm text-ink-muted">Publiez d&apos;abord un post, un snippet public ou un projet.</p>
      )}
      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={save} loading={setPinned.isPending}>
          Enregistrer
        </Button>
      </div>
    </Dialog>
  );
}

/** Compétences de la stack, endossées par les pairs (« +1 React Native par @dev_senegal »). */
export function Endorsements({ profile, isMe }: { profile: PublicProfile; isMe: boolean }) {
  const { isAuthenticated } = useSession();
  const endorsements = useEndorsements(profile.username);
  const endorse = useEndorse(profile.username);
  const toast = useToast();
  const rows = endorsements.data ?? profile.stack.map((skill) => ({ skill, count: 0, endorsers: [], endorsed_by_me: false }));
  if (!rows.length) return null;

  async function toggle(skill: string, mine: boolean) {
    try {
      await endorse.mutateAsync({ skill, endorse: !mine });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <div className="space-y-2 border-t border-line pt-4">
      <h3 className="text-body-sm font-semibold text-ink">Compétences</h3>
      <ul className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <li
            key={row.skill}
            className={cn(
              'flex h-8 items-center gap-2 rounded-full border pr-1 pl-3 text-body-sm',
              row.endorsed_by_me ? 'border-primary/30 bg-primary-soft' : 'border-line bg-card',
            )}
          >
            <span className="font-medium text-ink">{row.skill}</span>
            {row.count ? (
              <span
                className="flex items-center -space-x-1.5"
                title={`Endossé par ${row.endorsers.map((e) => `@${e.username}`).join(', ')}${row.count > row.endorsers.length ? '…' : ''}`}
              >
                {row.endorsers.map((endorser) => (
                  <Avatar key={endorser.id} name={endorser.display_name} src={endorser.avatar_url} size={18} className="ring-2 ring-card" />
                ))}
                <span className="pl-2.5 text-label-md font-semibold text-ink-muted tabular-nums">{row.count}</span>
              </span>
            ) : null}
            {isAuthenticated && !isMe ? (
              <button
                type="button"
                aria-pressed={row.endorsed_by_me}
                onClick={() => toggle(row.skill, row.endorsed_by_me)}
                disabled={endorse.isPending}
                title={row.endorsed_by_me ? 'Retirer mon +1' : `+1 ${row.skill}`}
                className={cn(
                  'inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-label-md font-semibold transition-colors',
                  row.endorsed_by_me ? 'bg-primary text-on-primary' : 'text-ink-muted hover:bg-container hover:text-ink',
                )}
              >
                {row.endorsed_by_me ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}1
              </button>
            ) : !row.count ? (
              <span className="pr-2" />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Section GitHub : dépôts, étoiles, langages principaux, dépôts phares. */
export function GitHubSection({ profile }: { profile: PublicProfile }) {
  const github = useGitHubOverview(profile.username, Boolean(profile.github_username));
  if (!profile.github_username || github.data === null) return null;
  if (!github.data) {
    return (
      <Card className="p-4 sm:p-6">
        <Skeleton className="h-32" />
      </Card>
    );
  }
  const data = github.data;
  const totalRepos = data.top_languages.reduce((sum, lang) => sum + lang.repos, 0) || 1;
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-headline-md text-ink">
          <Github className="size-5 text-ink-faint" aria-hidden /> GitHub
        </h2>
        <a href={data.html_url} target="_blank" rel="noopener noreferrer" className="text-body-sm font-medium text-ink-muted hover:text-ink hover:underline">
          @{data.login}
        </a>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          ['Dépôts publics', data.public_repos, FolderGit2],
          ['Étoiles', data.total_stars, Star],
          ['Abonnés', data.followers, UsersRound],
        ].map(([label, value, Icon]) => {
          const StatIcon = Icon as typeof Star;
          return (
            <div key={String(label)} className="rounded-xl border border-line bg-container-low/60 px-3.5 py-2.5">
              <dt className="flex items-center gap-1 text-label-md text-ink-faint">
                <StatIcon className="size-3" aria-hidden /> {String(label)}
              </dt>
              <dd className="text-headline-md text-ink tabular-nums">{formatCount(Number(value))}</dd>
            </div>
          );
        })}
      </dl>
      {data.top_languages.length ? (
        <div className="space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
            {data.top_languages.map((lang) => (
              <span key={lang.name} style={{ width: `${(lang.repos / totalRepos) * 100}%`, backgroundColor: languageColor(lang.name) }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label-md text-ink-muted">
            {data.top_languages.map((lang) => (
              <li key={lang.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: languageColor(lang.name) }} aria-hidden />
                <span className="font-medium text-ink">{lang.name}</span> {Math.round((lang.repos / totalRepos) * 100)} %
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.top_repos.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.top_repos.map((repo) => (
            <li key={repo.name}>
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col gap-1 rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-container-low/60"
              >
                <span className="flex items-center gap-1.5 truncate text-body-sm font-semibold text-ink">
                  <FolderGit2 className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                  {repo.name}
                </span>
                {repo.description ? <span className="line-clamp-2 text-label-md text-ink-muted">{repo.description}</span> : null}
                <span className="mt-auto flex items-center gap-3 pt-1 text-label-md text-ink-faint">
                  {repo.language ? (
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full" style={{ backgroundColor: languageColor(repo.language) }} aria-hidden />
                      {repo.language}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <Star className="size-3" aria-hidden /> {formatCount(repo.stars)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
