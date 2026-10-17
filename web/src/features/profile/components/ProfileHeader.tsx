'use client';

import { CalendarDays, Github, Info, Link2, MapPin, MoreHorizontal, Pencil, Share2, Sparkles, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { useOpenConversation } from '@/features/messaging';
import { errorMessage } from '@/shared/api';
import { cn, formatCount } from '@/shared/lib';
import { absoluteMediaUrl } from '@/shared/media';
import { useSession } from '@/shared/session';
import { Avatar, Button, Card, Dialog, EmptyState, Markdown, Menu, MenuItem, Skeleton, useToast } from '@/shared/ui';

import { type PublicProfile, useFollow, useFollowList } from '../api';
import { SPECIAL_BADGES } from './badges';
import { OpenToWork } from './ProSections';
import { SocialLinks } from './SocialLinks';

const SINCE = new Intl.DateTimeFormat('fr', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * En-tête façon TikTok : grand avatar rond, nom en gras et @pseudo, compteurs
 * Suivis / Followers / J'aime, puis Suivre · Message · partager · « … », et la bio.
 * La bannière (facultative) s'affiche en bandeau discret au-dessus.
 */
export function ProfileHeader({ profile, isMe, accent, onEdit }: { profile: PublicProfile; isMe: boolean; accent: string; onEdit: () => void }) {
  const toast = useToast();
  const name = profile.display_name || profile.username;
  const banner = absoluteMediaUrl(profile.banner_url);
  const special = profile.badges.filter((badge) => badge.code in SPECIAL_BADGES);

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
    <Card className="overflow-hidden">
      {banner ? (
        // eslint-disable-next-line @next/next/no-img-element -- image déjà recompressée (WebP) servie par le CDN
        <img src={banner} alt="" data-media decoding="async" className="h-28 w-full object-cover sm:h-36" />
      ) : null}

      <div className="px-5 pt-6 pb-6 sm:px-8 sm:pt-8">
        <div className="flex items-start gap-5 sm:gap-8">
          <Avatar
            name={name}
            src={profile.avatar_url}
            color={accent}
            size={160}
            className="order-2 size-24! shrink-0 text-[2.25rem]! sm:order-1 sm:size-40! sm:text-[3rem]!"
          />
          <div className="order-1 min-w-0 flex-1 sm:order-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <h1 className="flex flex-wrap items-center gap-2 text-[1.75rem] leading-tight font-extrabold tracking-tight text-ink sm:text-[2rem]">
                <span className="break-words">{name}</span>
                {special.map((badge) => {
                  const { icon: Icon, className } = SPECIAL_BADGES[badge.code]!;
                  return (
                    <span
                      key={badge.code}
                      title={`${badge.label} : ${badge.description}`}
                      className={cn('inline-flex size-6 items-center justify-center rounded-full ring-1', className)}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      <span className="sr-only">{badge.label}</span>
                    </span>
                  );
                })}
              </h1>
              <span className="hidden h-5 w-px bg-line-strong sm:block" aria-hidden />
              <p className="text-body-lg text-ink-muted">@{profile.username}</p>
            </div>

            <StatsBar profile={profile} accent={accent} />

            <div className="mt-4 hidden items-center gap-2 sm:flex">
              <Actions profile={profile} isMe={isMe} onEdit={onEdit} onShare={share} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 sm:hidden">
          <Actions profile={profile} isMe={isMe} onEdit={onEdit} onShare={share} />
        </div>

        {profile.bio ? <Markdown source={profile.bio} breaks className="mt-4 max-w-prose text-body-md text-ink [&_p]:my-1" /> : null}
        {profile.stack?.length ? <p className="mt-2 text-body-sm text-ink-muted">{profile.stack.slice(0, 6).join(' · ')}</p> : null}

        <SocialLinks links={profile.social_links} className="mt-3" />

        <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body-sm text-ink-muted">
          {profile.location ? (
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4 text-ink-faint" aria-hidden /> {profile.location}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-4 text-ink-faint" aria-hidden /> Membre depuis {SINCE.format(new Date(profile.created_at))}
          </li>
          {profile.github_username && !profile.social_links?.github ? (
            <li>
              <a href={`https://github.com/${profile.github_username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-ink hover:underline">
                <Github className="size-4 text-ink-faint" aria-hidden /> {profile.github_username}
              </a>
            </li>
          ) : null}
          {profile.website ? (
            <li>
              <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 font-medium text-ink hover:underline">
                <Link2 className="size-4 text-ink-faint" aria-hidden /> {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </li>
          ) : null}
        </ul>
        <div className="w-full max-w-xl">
          <OpenToWork profile={profile} />
        </div>
      </div>
    </Card>
  );
}

const roundAction =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-container text-ink transition-colors hover:bg-container-high';

/** Rangée d'actions : Suivre (rouge plein) · Message · partager · « … » (ou Modifier pour soi). */
function Actions({ profile, isMe, onEdit, onShare }: { profile: PublicProfile; isMe: boolean; onEdit: () => void; onShare: () => void }) {
  const toast = useToast();
  if (isMe) {
    return (
      <>
        <Button className="h-11 min-w-0 flex-1 rounded-full px-3 sm:w-56 sm:flex-none" variant="primary" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> Modifier le profil
        </Button>
        <button type="button" onClick={onShare} aria-label="Partager le profil" className={roundAction}>
          <Share2 className="size-5" aria-hidden />
        </button>
      </>
    );
  }
  return (
    <>
      <FollowButton profile={profile} />
      <MessageButton username={profile.username} />
      <button type="button" onClick={onShare} aria-label="Partager le profil" className={roundAction}>
        <Share2 className="size-5" aria-hidden />
      </button>
      <Menu
        className="w-52"
        trigger={(props) => (
          <button type="button" aria-label="Plus d'actions" {...props} className={cn(roundAction, 'max-sm:hidden')}>
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        )}
      >
        <MenuItem onSelect={() => void navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`).then(() => toast('Lien du profil copié.'))}>
          <Link2 aria-hidden /> Copier le lien
        </MenuItem>
      </Menu>
    </>
  );
}

function FollowButton({ profile }: { profile: PublicProfile }) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const follow = useFollow(profile.username);
  const following = profile.is_following;
  return (
    <Button
      className={cn('h-11 min-w-0 flex-1 rounded-full px-3 sm:w-44 sm:flex-none', following && 'bg-container text-ink hover:bg-container-high')}
      variant={following ? 'ghost' : 'primary'}
      aria-pressed={following}
      onClick={() => {
        if (!isAuthenticated) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        follow.mutate(!following, { onError: (error) => toast(errorMessage(error)) });
      }}
    >
      {following ? <UserCheck className="size-4" aria-hidden /> : null}
      {following ? 'Abonné·e' : 'Suivre'}
    </Button>
  );
}

/** Ouvre (ou crée) la conversation avec ce membre, puis la messagerie. */
function MessageButton({ username }: { username: string }) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const open = useOpenConversation();
  return (
    <Button
      variant="ghost"
      className="h-11 min-w-0 flex-1 rounded-full bg-container px-3 font-semibold text-ink hover:bg-container-high sm:w-36 sm:flex-none"
      loading={open.isPending}
      onClick={() => {
        if (!isAuthenticated) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        open.mutate(username, {
          onSuccess: (conversation) => router.push(`/messages?c=${conversation.id}`),
          onError: (error) => toast(errorMessage(error), 'error'),
        });
      }}
    >
      Message
    </Button>
  );
}

/** « 946 Suivis  16,4 k Followers  270 k J'aime  · Craft » : les deux premiers ouvrent la liste. */
function StatsBar({ profile, accent }: { profile: PublicProfile; accent: string }) {
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const likes = (profile.craft.creation.breakdown.post_upvotes ?? 0) + (profile.craft.help.breakdown.answer_upvotes ?? 0);
  const stat = 'flex items-baseline gap-1.5 rounded-lg transition-colors hover:text-primary-ink';
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="button" className={stat} onClick={() => setList('following')}>
          <span className="text-[1.125rem] font-bold text-ink tabular-nums">{formatCount(profile.following_count)}</span>
          <span className="text-body-md text-ink-muted">Suivis</span>
        </button>
        <button type="button" className={stat} onClick={() => setList('followers')}>
          <span className="text-[1.125rem] font-bold text-ink tabular-nums">{formatCount(profile.followers_count)}</span>
          <span className="text-body-md text-ink-muted">Followers</span>
        </button>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[1.125rem] font-bold text-ink tabular-nums">{formatCount(likes)}</span>
          <span className="text-body-md text-ink-muted">J&apos;aime</span>
        </span>
        <CraftStat profile={profile} accent={accent} className="flex items-baseline" />
      </div>
      <FollowListDialog username={profile.username} kind={list} onClose={() => setList(null)} />
    </>
  );
}

/** Craft Score, avec une infobulle (survol, focus clavier ou toucher) Entraide vs Création. */
function CraftStat({ profile, accent, className }: { profile: PublicProfile; accent: string; className: string }) {
  const tooltipId = useId();
  const craft = profile.craft;
  const total = Math.max(1, craft.help.score + craft.creation.score);
  return (
    <div className={cn(className, 'group relative')}>
      <button type="button" aria-describedby={tooltipId} className="flex items-baseline gap-1.5 outline-none">
        <span className="flex items-center gap-1 text-[1.125rem] font-bold tabular-nums" style={{ color: accent }}>
          <Sparkles className="size-4 self-center" aria-hidden />
          {formatCount(craft.score)}
        </span>
        <span className="flex items-center gap-1 text-body-md text-ink-muted">
          Craft <Info className="size-3 self-center" aria-hidden />
        </span>
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-xl border border-line bg-card p-3 text-left opacity-0 shadow-raised transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-container-high" aria-hidden>
          <span className="bg-secondary" style={{ width: `${(craft.help.score / total) * 100}%` }} />
          <span className="bg-primary" style={{ width: `${(craft.creation.score / total) * 100}%` }} />
        </div>
        <p className="flex justify-between text-body-sm">
          <span className="flex items-center gap-1.5 text-ink">
            <span className="size-2 rounded-full bg-secondary" aria-hidden /> Entraide
          </span>
          <span className="font-semibold text-ink tabular-nums">{formatCount(craft.help.score)}</span>
        </p>
        <p className="mt-1 flex justify-between text-body-sm">
          <span className="flex items-center gap-1.5 text-ink">
            <span className="size-2 rounded-full bg-primary" aria-hidden /> Création
          </span>
          <span className="font-semibold text-ink tabular-nums">{formatCount(craft.creation.score)}</span>
        </p>
        <p className="mt-2 border-t border-line pt-2 text-label-md text-ink-faint">
          Entraide : +5 par pouce levé sur une réponse, +15 par réponse acceptée. Création : +5 par pouce levé sur un post, +10 par snippet mis en favori.
        </p>
      </div>
    </div>
  );
}

function FollowListDialog({ username, kind, onClose }: { username: string; kind: 'followers' | 'following' | null; onClose: () => void }) {
  return (
    <Dialog open={kind !== null} onClose={onClose} title={kind === 'followers' ? 'Abonnés' : 'Abonnements'}>
      {kind ? <FollowList username={username} kind={kind} onNavigate={onClose} /> : null}
    </Dialog>
  );
}

function FollowList({ username, kind, onNavigate }: { username: string; kind: 'followers' | 'following'; onNavigate: () => void }) {
  const list = useFollowList(username, kind, true);
  if (list.isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (!list.items.length) {
    return <EmptyState title={kind === 'followers' ? 'Aucun abonné pour le moment' : 'Ne suit personne pour le moment'} />;
  }
  return (
    <div className="max-h-[60vh] space-y-1 overflow-y-auto">
      <ul>
        {list.items.map((member) => (
          <li key={member.id}>
            <Link href={`/u/${member.username}`} onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-container-low">
              <Avatar name={member.display_name} src={member.avatar_url} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md font-semibold text-ink">{member.display_name}</span>
                <span className="block truncate text-body-sm text-ink-muted">
                  @{member.username}
                  {member.stack.length ? ` · ${member.stack.join(', ')}` : ''}
                </span>
              </span>
              {member.is_following ? <span className="text-label-md text-ink-faint">Suivi·e</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {list.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </div>
  );
}
