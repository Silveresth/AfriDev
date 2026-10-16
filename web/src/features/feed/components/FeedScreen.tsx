'use client';

import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Code2,
  Flame,
  FolderGit2,
  Home,
  ImageIcon,
  MessagesSquare,
  Newspaper,
  Plus,
  Rows3,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useLang } from '@/shared/i18n';
import { ContextTabs, PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { useOutbox } from '@/shared/offline';
import { useSession } from '@/shared/session';
import {
  Button,
  ButtonLink,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  FilterChips,
  LogoMark,
  Menu,
  MenuItem,
  Segmented,
  StatusBadge,
} from '@/shared/ui';

import { type FeedSort, type HomeFilter, type HomeItem, type HomeScope, type PostKind, useFeed, useHomeFeed } from '../api';
import { CommunityHeader } from './Communities';
import { HomeCard } from './HomeCard';
import { MobileHubsBar } from './MobileHubsBar';
import { PostCard } from './PostCard';

type KindFilter = 'all' | PostKind;

const FILTERS: Array<{ value: HomeFilter; label: string; icon: typeof Rows3 }> = [
  { value: 'all', label: 'Tout', icon: Rows3 },
  { value: 'posts', label: 'Posts', icon: Newspaper },
  { value: 'questions', label: 'Entraide', icon: MessagesSquare },
  { value: 'snippets', label: 'Snippets', icon: Code2 },
  { value: 'projects', label: 'Projets', icon: FolderGit2 },
  { value: 'jobs', label: 'Opportunités', icon: BriefcaseBusiness },
];

/**
 * Accueil : un fil mixte (posts, entraide, snippets, projets, opportunités) classé selon vos
 * préférences, ou celui des membres que vous suivez. ?tag=… ouvre la communauté d/<tag>.
 * L'actu tech a sa page (/news) et sa colonne à droite.
 */
export function FeedScreen({ aside }: { aside?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { t } = useLang();
  const tag = params.get('tag') ?? undefined;

  // Anciens liens « ?tab=news » : l'actu tech a désormais sa propre page.
  useEffect(() => {
    if (params.get('tab') === 'news') router.replace('/news');
  }, [params, router]);

  return (
    <TwoColumns aside={aside}>
      <MobileHubsBar />
      {tag ? (
        <CommunityHeader tag={tag} />
      ) : (
        <PageHeader className="mb-2" icon={<Home aria-hidden />} title={t('nav.home')} description="Posts, entraide, code, projets et opportunités de la communauté." />
      )}
      {!isAuthenticated && !tag ? <WelcomeCard /> : null}
      {tag ? <TagFeed tag={tag} /> : <MixedFeed />}
    </TwoColumns>
  );
}

function setParamOn(router: ReturnType<typeof useRouter>, params: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  router.replace(`/${next.size ? `?${next}` : ''}`, { scroll: false });
}

function PendingPosts() {
  const { t } = useLang();
  const pending = useOutbox('posts');
  return (
    <>
      {pending.map((entry) => (
        <div key={entry.id} className="space-y-2 rounded-2xl border border-dashed border-line-strong bg-card p-4">
          <StatusBadge tone="offline">
            <Clock className="size-3" aria-hidden /> {t('settings.outbox.pending')}
          </StatusBadge>
          <p className="font-semibold text-ink">{String(entry.data.title || entry.data.body || '')}</p>
          <p className="text-body-sm text-ink-faint">Sera publié automatiquement au retour de la connexion.</p>
        </div>
      ))}
    </>
  );
}

function MixedFeed() {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { t } = useLang();
  const filter = (params.get('filter') as HomeFilter | null) ?? 'all';
  const scope: HomeScope = isAuthenticated && params.get('scope') === 'following' ? 'following' : 'for_you';
  const feed = useHomeFeed(filter, scope);

  return (
    <>
      <ContextTabs<HomeScope>
        value={scope}
        onChange={(value) => setParamOn(router, params, 'scope', value === 'for_you' ? null : value)}
        options={[
          { value: 'for_you', label: 'Pour vous', icon: <Sparkles aria-hidden /> },
          ...(isAuthenticated ? [{ value: 'following' as const, label: 'Abonnements', icon: <UsersRound aria-hidden /> }] : []),
        ]}
        actions={
          isAuthenticated ? (
            <ButtonLink href="/submit" size="sm" variant="primary">
              <Plus className="size-4" aria-hidden /> Publier
            </ButtonLink>
          ) : null
        }
      />
      <FilterChips<HomeFilter>
        value={filter}
        onChange={(value) => setParamOn(router, params, 'filter', value === 'all' ? null : value)}
        options={FILTERS.map((item) => ({ value: item.value, label: item.label, icon: <item.icon className="size-4" aria-hidden /> }))}
      />

      <PendingPosts />

      {feed.isPending ? (
        <>
          <CardSkeleton />
          <CardSkeleton lines={4} />
        </>
      ) : feed.isError && !feed.items.length ? (
        <ErrorNotice message="Le fil n'est pas encore disponible sur cet appareil. Il s'affichera dès le retour du réseau." />
      ) : !feed.items.length ? (
        <EmptyState
          icon={scope === 'following' ? <UsersRound className="size-7" aria-hidden /> : <Newspaper className="size-7" aria-hidden />}
          title={scope === 'following' ? 'Personne à suivre pour l’instant' : t('feed.empty')}
          action={
            scope === 'following' ? (
              <ButtonLink href="/search" variant="outline">
                Découvrir des membres
              </ButtonLink>
            ) : isAuthenticated ? (
              <ButtonLink href="/submit">
                <Plus className="size-4" aria-hidden /> {t('feed.new_post')}
              </ButtonLink>
            ) : undefined
          }
        >
          {scope === 'following'
            ? 'Suivez des développeur·ses depuis leur profil : leurs publications apparaîtront ici.'
            : 'Soyez le premier à partager une astuce avec la communauté.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {feed.items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <HomeEntry item={item} />
            </li>
          ))}
        </ul>
      )}

      {feed.hasNextPage ? (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
          {t('common.see_more')}
        </Button>
      ) : null}
    </>
  );
}

function HomeEntry({ item }: { item: HomeItem }) {
  if (item.type === 'post') return item.post ? <PostCard post={item.post} community /> : null;
  return <HomeCard item={item} />;
}

/** Communauté d/<tag> : posts du tag, triés (populaires, nouveaux, mieux notés) et par format. */
function TagFeed({ tag }: { tag: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { t } = useLang();
  const kind = (params.get('kind') as KindFilter | null) ?? 'all';
  const sort = (params.get('sort') as FeedSort | null) ?? 'hot';
  const feed = useFeed({ tag, sort, kind: kind === 'all' ? undefined : kind });
  const set = (key: string, value: string | null) => setParamOn(router, params, key, value);

  const sorts: Array<{ value: FeedSort; label: string; icon: typeof Flame }> = [
    { value: 'hot', label: t('feed.sort_hot'), icon: Flame },
    { value: 'new', label: t('feed.sort_new'), icon: Sparkles },
    { value: 'top', label: t('feed.sort_top'), icon: TrendingUp },
  ];
  const kinds: Array<{ value: KindFilter; label: string; icon: typeof Rows3 }> = [
    { value: 'all', label: t('feed.filter_all'), icon: Rows3 },
    { value: 'text', label: t('feed.filter_posts'), icon: Newspaper },
    { value: 'poll', label: t('feed.filter_polls'), icon: BarChart3 },
    { value: 'short', label: t('feed.filter_videos'), icon: Clapperboard },
    { value: 'image', label: t('feed.filter_images'), icon: ImageIcon },
  ];
  const currentKind = kinds.find((item) => item.value === kind) ?? kinds[0]!;

  return (
    <>
      <Toolbar>
        <Segmented<FeedSort>
          value={sort}
          onChange={(value) => set('sort', value === 'hot' ? null : value)}
          options={sorts.map((item) => ({ value: item.value, label: item.label, icon: <item.icon aria-hidden /> }))}
        />
        <div className="ml-auto">
          <Menu
            className="w-56"
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-body-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <currentKind.icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{currentKind.label}</span>
                <ChevronDown className="size-4" aria-hidden />
              </button>
            )}
          >
            {kinds.map((item) => (
              <MenuItem key={item.value} onSelect={() => set('kind', item.value === 'all' ? null : item.value)}>
                <item.icon aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.value === kind ? <Check className="!text-ink" aria-hidden /> : null}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </Toolbar>

      <PendingPosts />

      {feed.isPending ? (
        <CardSkeleton />
      ) : feed.isError && !feed.items.length ? (
        <ErrorNotice message="Le fil n'est pas encore disponible sur cet appareil. Il s'affichera dès le retour du réseau." />
      ) : !feed.items.length ? (
        <EmptyState
          icon={<Newspaper className="size-7" aria-hidden />}
          title={`Rien encore dans d/${tag}`}
          action={
            isAuthenticated ? (
              <ButtonLink href={`/submit?tag=${encodeURIComponent(tag)}`}>
                <Plus className="size-4" aria-hidden /> {t('feed.new_post')}
              </ButtonLink>
            ) : undefined
          }
        >
          Soyez le premier à partager une astuce avec la communauté.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {feed.items.map((post) => (
            <li key={post.id}>
              <PostCard post={post} community={false} />
            </li>
          ))}
        </ul>
      )}

      {feed.hasNextPage ? (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
          {t('common.see_more')}
        </Button>
      ) : null}
    </>
  );
}

function WelcomeCard() {
  const { t } = useLang();
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center">
      <LogoMark size={48} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-headline-md text-ink">{t('auth.features_headline')}</h2>
        <p className="text-body-md text-ink-muted">{t('auth.features_sub')}</p>
      </div>
      <ButtonLink href="/login" className="shrink-0">
        {t('auth.register')}
      </ButtonLink>
    </section>
  );
}
