'use client';

import { linkDomain } from '@afridev/validation';
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Clapperboard,
  Ellipsis,
  ExternalLink,
  Globe,
  Link2,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BookmarkButton } from '@/features/bookmarks';
import { EditTextDialog, InlineThread, ScorePill } from '@/features/engage';
import { ReportButton } from '@/features/moderation';
import { TranslateButton } from '@/features/translation';
import { errorMessage } from '@/shared/api';
import { cn, formatCount } from '@/shared/lib';
import { type MediaAsset, MediaView } from '@/shared/media';
import { useSession } from '@/shared/session';
import {
  AuthorBadges,
  Avatar,
  CommunityIcon,
  Markdown,
  Menu,
  MenuItem,
  pillAction,
  StatusBadge,
  HubLink,
  HubRoleBadge,
  KarmaPill,
  Tag,
  TechBadge,
  TimeAgo,
  useToast,
} from '@/shared/ui';

import { type Post, useDeletePost, usePinPost, useScoreVote, useUpdatePost, useVote } from '../api';

/**
 * Carte de post / discussion, façon Dev.to : carte encadrée et cliquable.
 * - en-tête : avatar, nom, badges Pays / Spécialité, temps écoulé et hub (d/communauté) ;
 * - corps : titre, aperçu du texte (fondu), sondage, média, tags ;
 * - pied : votes ↑ score ↓, commentaires, partager, traduire, marque-page, signaler.
 * En page détail (`detail`) : texte complet, titre en h1.
 * `community={false}` sur la page d'une communauté (inutile d'y répéter le hub).
 */
export function PostCard({ post, detail = false, community: showCommunity = true }: { post: Post; detail?: boolean; community?: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const remove = useDeletePost();
  const toast = useToast();
  const name = post.author?.display_name || post.author?.username || 'Membre';
  const mine = Boolean(user && post.author?.id === user.id);
  // Modérateur du hub (ou staff) : épingler, supprimer le post d'un autre membre.
  const moderator = Boolean(post.viewer?.can_moderate);
  const canEdit = mine || Boolean(user?.is_staff);
  const update = useUpdatePost(post.id);
  const [editing, setEditing] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const pin = usePinPost();
  const postTags = Array.isArray(post.tags) ? post.tags : [];
  const [community, ...rest] = postTags;
  // Rangé dans un hub : tous les tags sont affichés ; sinon le premier tient lieu de communauté.
  const otherTags = post.hub ? postTags : rest;
  const badgeLabel = Array.isArray(post.author?.badges) && post.author.badges.length > 0
    ? post.author.badges[0]?.label
    : undefined;
  const href = `/feed/${post.id}`;
  // Post « ressource » : la carte mène au lien externe ; la discussion reste sur /feed/<id>.
  const link = post.link_url || '';
  const openCard = () => (link ? window.open(link, '_blank', 'noopener,noreferrer') : router.push(href));
  const isVideo = (post.media as MediaAsset | null)?.kind === 'video';
  // Posts antérieurs aux titres : la première ligne du texte en tient lieu.
  const title = post.title || (post.kind === 'poll' ? post.body : '');
  const body = post.kind === 'poll' && !post.title ? '' : post.body;

  async function share() {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ url, title: title || 'AfriDev Exchange' });
      else {
        await navigator.clipboard.writeText(url);
        toast('Lien copié.');
      }
    } catch {
      // partage annulé
    }
  }

  const TitleTag = detail ? 'h1' : 'h2';
  const profileHref = post.author ? `/u/${post.author.username}` : undefined;

  return (
    <article
      id={`post-${post.id}`}
      onClick={detail ? undefined : (event) => openOnCardClick(event, openCard)}
      className={cn(
        'group rounded-2xl border border-line bg-card shadow-card',
        !detail && 'cursor-pointer transition-colors hover:border-line-strong',
      )}
    >
      <div className={cn('px-4 pt-4 sm:px-5', detail && 'sm:pt-5')}>
        <header className="flex items-start gap-3">
          {/* Avatar, et le karma de l'auteur juste dessous. */}
          <div className="flex w-10 shrink-0 flex-col items-center gap-1">
            {profileHref ? (
              <Link href={profileHref} tabIndex={-1} aria-hidden>
                <Avatar name={name} src={post.author?.avatar_url} size={detail ? 40 : 36} />
              </Link>
            ) : (
              <Avatar name={name} size={detail ? 40 : 36} />
            )}
            {post.author?.karma ? <KarmaPill karma={post.author.karma} className="text-[0.6875rem]" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              {profileHref ? (
                <Link href={profileHref} className="truncate text-body-sm font-semibold text-ink hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="truncate text-body-sm font-semibold text-ink">{name}</span>
              )}
              <HubRoleBadge role={post.author_role} />
              <AuthorBadges location={post.author?.location} stack={post.author?.stack} />
              {badgeLabel ? <TechBadge label={badgeLabel} /> : null}
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-label-md text-ink-faint">
              {detail ? (
                <TimeAgo date={post.created_at} className="shrink-0" />
              ) : (
                <Link href={href} className="shrink-0 hover:text-ink hover:underline" title="Ouvrir la discussion">
                  <TimeAgo date={post.created_at} />
                </Link>
              )}
              {post.hub && showCommunity ? (
                <>
                  <span aria-hidden>·</span>
                  <HubLink hub={post.hub} />
                </>
              ) : community && showCommunity ? (
                <>
                  <span aria-hidden>·</span>
                  <Link
                    href={`/feed?tag=${encodeURIComponent(community)}`}
                    className="inline-flex min-w-0 items-center gap-1 font-medium text-ink-muted hover:text-ink hover:underline"
                  >
                    <CommunityIcon tag={community} size={14} className="rounded-[4px]" />
                    <span className="truncate">d/{community}</span>
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            {post.is_pinned ? (
              <StatusBadge tone="primary" dot={false}>
                <Pin className="size-3.5" aria-hidden /> Épinglé
              </StatusBadge>
            ) : null}
            {post.kind === 'poll' ? (
              <StatusBadge tone="warning" dot={false}>
                <BarChart3 className="size-3.5" aria-hidden /> Sondage
              </StatusBadge>
            ) : null}
            {post.kind === 'short' ? (
              <StatusBadge tone="primary" dot={false}>
                <Clapperboard className="size-3.5" aria-hidden /> Vidéo
              </StatusBadge>
            ) : null}
            {canEdit || moderator ? (
              <Menu
                className="w-52"
                trigger={(props) => (
                  <button
                    type="button"
                    aria-label="Plus d'actions"
                    {...props}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-faint hover:bg-container hover:text-ink"
                  >
                    <Ellipsis className="size-4" aria-hidden />
                  </button>
                )}
              >
                <MenuItem onSelect={() => void navigator.clipboard.writeText(`${window.location.origin}${href}`).then(() => toast('Lien copié.'))}>
                  <Link2 aria-hidden /> Copier le lien
                </MenuItem>
                {canEdit ? (
                  <MenuItem onSelect={() => setEditing(true)}>
                    <Pencil aria-hidden /> Modifier
                  </MenuItem>
                ) : null}
                {moderator && post.hub ? (
                  <MenuItem
                    onSelect={() =>
                      pin.mutate(
                        { id: post.id, pinned: !post.is_pinned },
                        {
                          onSuccess: (updated) => toast(updated.is_pinned ? 'Post épinglé en tête du hub.' : 'Post détaché.'),
                          onError: (error) => toast(errorMessage(error), 'error'),
                        },
                      )
                    }
                  >
                    {post.is_pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                    {post.is_pinned ? 'Détacher' : 'Épingler dans le hub'}
                  </MenuItem>
                ) : null}
                <MenuItem
                  danger
                  onSelect={() => {
                    if (!window.confirm(mine ? 'Supprimer ce post ?' : 'Supprimer ce post en tant que modérateur ou admin ?')) return;
                    remove.mutate(post.id, { onSuccess: () => detail && router.push('/feed') });
                  }}
                >
                  <Trash2 aria-hidden /> Supprimer
                </MenuItem>
              </Menu>
            ) : null}
          </span>
        </header>

        {/* Dans le fil, le contenu s'aligne sur le nom (retrait de la largeur de l'avatar). */}
        <div className={cn(!detail && 'sm:pl-[3.25rem]')}>
          {title ? (
            <TitleTag
              className={cn(
                'mt-3 text-ink',
                detail ? 'text-headline-xl' : 'text-[1.1875rem] leading-snug font-bold tracking-[-0.015em] transition-colors group-hover:text-primary-ink',
              )}
            >
              {link && !detail ? (
                <a href={link} target="_blank" rel="noopener noreferrer nofollow ugc" className="hover:underline">
                  {title}
                  <ExternalLink className="ml-1.5 inline size-4 align-[-0.125em] text-ink-faint" aria-label="(lien externe)" />
                </a>
              ) : (
                title
              )}
            </TitleTag>
          ) : null}
          {link ? <ResourceLink url={link} large={detail} /> : null}

          {body ? (
            detail ? (
              <div className="mt-3 text-body-lg">
                <Markdown source={body} />
              </div>
            ) : (
              // Aperçu : quelques lignes, fondu en bas ; le texte complet est sur la page du post.
              <div className={cn('relative mt-1.5 overflow-hidden text-ink-muted', title ? 'max-h-[6rem]' : 'max-h-[14rem] text-ink')}>
                <Markdown source={body} />
                {body.length > (title ? 180 : 600) ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
                ) : null}
              </div>
            )
          ) : null}

          {post.kind === 'poll' ? (
            <div className="mt-3">
              <Poll post={post} />
            </div>
          ) : null}
          {/* Le schéma décrit `media` comme JSON libre : c'est la forme de /api/media/<id>/. */}
          {post.media ? (
            // Vidéo : lecteur centré sur un fond noir (une vidéo portrait est plus étroite que la carte).
            <div className={cn('mt-3 overflow-hidden rounded-lg border border-line', isVideo && 'bg-black')}>
              <MediaView media={post.media as MediaAsset} className="rounded-none border-0" />
            </div>
          ) : null}

          {otherTags.length ? (
            <div className="mt-2.5 -ml-1.5 flex flex-wrap gap-0.5">
              {otherTags.map((tag) => (
                <Tag key={tag} href={`/feed?tag=${encodeURIComponent(tag)}`}>
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <footer className={cn('mt-3 flex flex-wrap items-center gap-0.5 px-3 pb-3 sm:gap-1 sm:px-4', !detail && 'sm:pl-[4.25rem]')}>
        <VotePill post={post} />
        {detail ? (
          <span className={cn(pillAction, 'hover:bg-transparent')}>
            <MessageSquare className="size-4" aria-hidden /> {formatCount(post.comment_count)}
            <span className="hidden sm:inline">commentaire{post.comment_count > 1 ? 's' : ''}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setThreadOpen((value) => !value)}
            aria-expanded={threadOpen}
            className={cn(pillAction, 'max-sm:px-2', threadOpen && 'bg-container text-ink')}
          >
            <MessageSquare className="size-4" aria-hidden /> {formatCount(post.comment_count)}
            <span className="hidden sm:inline">commentaire{post.comment_count > 1 ? 's' : ''}</span>
            <span className="sr-only sm:hidden">commentaires</span>
          </button>
        )}
        <button type="button" onClick={share} className={cn(pillAction, 'max-sm:px-1.5')}>
          <Share2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Partager</span>
          <span className="sr-only sm:hidden">Partager</span>
        </button>
        {post.body || post.title ? <TranslateButton compact={!detail} text={[post.title, post.body].filter(Boolean).join('\n\n')} /> : null}
        <span className="ml-auto flex items-center">
          <BookmarkButton target={{ type: 'post', id: post.id }} title={title || body.slice(0, 80) || 'Post'} />
          {!mine ? <ReportButton targetType="post" targetId={post.id} compact /> : null}
        </span>
      </footer>
      {threadOpen && !detail ? <InlineThread kind="post" id={post.id} href={href} /> : null}
      {editing ? (
        <EditTextDialog
          title="Modifier le post"
          initial={{ title: post.title, body: post.body, tags: postTags, link_url: post.link_url ?? '' }}
          onSave={(content) => update.mutateAsync(content)}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </article>
  );
}

function VotePill({ post }: { post: Post }) {
  const vote = useScoreVote(post);
  // Un post mis en cache avant les votes ↑/↓ (cache hors ligne, ISR) n'a pas encore de score.
  const score = post.score ?? post.like_count ?? 0;
  return <ScorePill score={score} value={post.viewer?.post_vote ?? 0} onVote={(value) => vote.mutate(value)} loginNext={`/feed/${post.id}`} />;
}

/** Ressource externe du post : domaine et bouton d'ouverture (nouvel onglet, sans transmettre la page). */
function ResourceLink({ url, large }: { url: string; large: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className={cn(
        'mt-2.5 flex items-center gap-3 rounded-xl border border-line bg-container-low transition-colors hover:border-primary/40 hover:bg-primary-soft/40',
        large ? 'p-3.5' : 'px-3 py-2',
      )}
    >
      <span className={cn('flex shrink-0 items-center justify-center rounded-lg bg-card text-primary-ink', large ? 'size-10' : 'size-8')}>
        <Globe className={large ? 'size-5' : 'size-4'} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-ink">{linkDomain(url)}</span>
        <span className="block truncate text-label-md text-ink-faint">{url.replace(/^https?:\/\/(www\.)?/i, '')}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-body-sm font-semibold text-primary-ink">
        <span className={large ? undefined : 'hidden sm:inline'}>Ouvrir la ressource</span>
        <ExternalLink className="size-4" aria-hidden />
      </span>
    </a>
  );
}

/** Un clic dans le bloc ouvre la discussion (ou la ressource du post), sauf sur un élément interactif, du code ou une sélection. */
function openOnCardClick(event: React.MouseEvent, open: () => void) {
  const target = event.target as HTMLElement;
  if (target.closest('a, button, input, textarea, video, pre, [role="menu"], dialog')) return;
  if (window.getSelection()?.toString()) return;
  open();
}

function Poll({ post }: { post: Post }) {
  const { isAuthenticated: canVote } = useSession();
  const vote = useVote(post);
  const options = Array.isArray(post.poll_options) ? post.poll_options : [];
  const results = post.poll_results ?? options.map(() => 0);
  const total = results.reduce((sum, value) => sum + value, 0);
  const chosen = post.viewer?.vote ?? null;
  const leader = results.length > 0 ? Math.max(...results) : 0;
  const showResults = chosen !== null || !canVote;

  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const count = results[index] ?? 0;
        const percent = total ? Math.round((count / total) * 100) : 0;
        const selected = chosen === index;
        return (
          <button
            key={index}
            type="button"
            disabled={!canVote || vote.isPending}
            onClick={() => vote.mutate(index)}
            aria-pressed={selected}
            className={cn(
              'relative w-full overflow-hidden rounded-lg border bg-card text-left transition-colors disabled:cursor-default',
              selected ? 'border-primary' : 'border-line hover:border-line-strong',
            )}
          >
            {showResults ? (
              <span
                aria-hidden
                className={cn('absolute inset-y-0 left-0', count === leader && count > 0 ? 'bg-primary-soft' : 'bg-container')}
                style={{ width: `${percent}%` }}
              />
            ) : null}
            <span className="relative flex items-center justify-between gap-3 px-3.5 py-2.5 text-body-md">
              <span className="flex items-center gap-2 font-medium text-ink">
                {selected ? <CheckCircle2 className="size-[18px] text-primary" aria-hidden /> : <Circle className="size-[18px] text-ink-faint" aria-hidden />}
                {option}
              </span>
              {showResults ? <span className="text-body-sm font-semibold text-ink-muted tabular-nums">{percent} %</span> : null}
            </span>
          </button>
        );
      })}
      <p className="text-body-sm text-ink-faint">
        {total} vote{total > 1 ? 's' : ''}
        {!canVote ? ' · connectez-vous pour voter' : chosen === null ? ' · votez pour voir les résultats' : ''}
      </p>
    </div>
  );
}
