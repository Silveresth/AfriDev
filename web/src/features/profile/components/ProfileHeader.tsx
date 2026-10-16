'use client';

import { CalendarDays, Github, Info, Link2, MapPin, Pencil, Share2, Sparkles, UserCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn, formatCount } from '@/shared/lib';
import { absoluteMediaUrl } from '@/shared/media';
import { useSession } from '@/shared/session';
import { Avatar, Button, Card, Dialog, EmptyState, Markdown, Skeleton, useToast } from '@/shared/ui';

import { type PublicProfile, useFollow, useFollowList } from '../api';
import { SPECIAL_BADGES } from './badges';
import { OpenToWork } from './ProSections';
import { SocialLinks } from './SocialLinks';

const SINCE = new Intl.DateTimeFormat('fr', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * En-tête immersif : bannière plein cadre assombrie en dégradé, avatar centré qui la chevauche,
 * statistiques en 3 colonnes, action principale, bio Markdown et réseaux sociaux.
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
      <div className="relative h-44 sm:h-60" style={{ backgroundColor: accent }}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element -- image déjà recompressée (WebP) servie par le CDN
          <img src={banner} alt="" data-media decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.22)_1px,transparent_1.2px)] bg-[length:14px_14px] [mask-image:linear-gradient(105deg,transparent_10%,black_75%)]" aria-hidden />
        )}
        {/* Dégradé d'assombrissement : lisibilité des actions et transition douce vers la carte. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-card" aria-hidden />
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={share}
            aria-label="Partager le profil"
            className="flex size-9 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-black/50"
          >
            <Share2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative -mt-20 flex flex-col items-center px-5 pb-6 text-center sm:-mt-24 sm:px-8">
        <Avatar name={name} src={profile.avatar_url} color={accent} size={136} className="text-[2.75rem] shadow-raised ring-[5px] ring-card" />

        <h1 className="mt-3 flex flex-wrap items-center justify-center gap-2 text-headline-xl text-ink">
          {name}
          {special.map((badge) => {
            const { icon: Icon, className } = SPECIAL_BADGES[badge.code]!;
            return (
              <span
                key={badge.code}
                title={`${badge.label} : ${badge.description}`}
                className={cn('inline-flex size-7 items-center justify-center rounded-full ring-1', className)}
              >
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">{badge.label}</span>
              </span>
            );
          })}
        </h1>
        <p className="mt-0.5 text-body-md text-ink-muted">
          @{profile.username}
          {profile.stack?.length ? <span className="text-ink"> · {profile.stack.slice(0, 3).join(', ')}</span> : null}
        </p>

        <StatsBar profile={profile} accent={accent} />

        <div className="mt-4 flex w-full max-w-xs justify-center gap-2">
          {isMe ? (
            <Button className="flex-1" variant="outline" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden /> Modifier mon profil
            </Button>
          ) : (
            <FollowButton profile={profile} />
          )}
        </div>

        {profile.bio ? <Markdown source={profile.bio} breaks className="mt-5 max-w-prose text-body-lg [&_p]:my-1" /> : null}

        <SocialLinks links={profile.social_links} className="mt-4 justify-center" />

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-body-sm text-ink-muted">
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
        <div className="w-full max-w-xl text-left">
          <OpenToWork profile={profile} />
        </div>
      </div>
    </Card>
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
      className="flex-1"
      variant={following ? 'outline' : 'primary'}
      aria-pressed={following}
      onClick={() => {
        if (!isAuthenticated) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        follow.mutate(!following, { onError: (error) => toast(errorMessage(error)) });
      }}
    >
      {following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
      {following ? 'Abonné·e' : 'Suivre'}
    </Button>
  );
}

/** [Abonnements] | [Abonnés] | [Craft Score] : les deux premiers ouvrent la liste. */
function StatsBar({ profile, accent }: { profile: PublicProfile; accent: string }) {
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const cell = 'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-colors';
  return (
    <>
      <div className="mt-5 flex w-full max-w-md items-stretch divide-x divide-line">
        <button type="button" className={cn(cell, 'hover:bg-container-low')} onClick={() => setList('following')}>
          <span className="text-headline-md text-ink tabular-nums">{formatCount(profile.following_count)}</span>
          <span className="text-label-md text-ink-muted">Abonnements</span>
        </button>
        <button type="button" className={cn(cell, 'hover:bg-container-low')} onClick={() => setList('followers')}>
          <span className="text-headline-md text-ink tabular-nums">{formatCount(profile.followers_count)}</span>
          <span className="text-label-md text-ink-muted">Abonnés</span>
        </button>
        <CraftStat profile={profile} accent={accent} className={cell} />
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
      <button type="button" aria-describedby={tooltipId} className="flex flex-col items-center gap-0.5 outline-none">
        <span className="flex items-center gap-1 text-headline-md tabular-nums" style={{ color: accent }}>
          <Sparkles className="size-4" aria-hidden />
          {formatCount(craft.score)}
        </span>
        <span className="flex items-center gap-1 text-label-md text-ink-muted">
          Craft Score <Info className="size-3" aria-hidden />
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
