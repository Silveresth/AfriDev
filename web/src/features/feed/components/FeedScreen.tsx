'use client';

import {
  BarChart3,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Flame,
  Home,
  ImageIcon,
  Newspaper,
  Plus,
  Rows3,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useLang } from '@/shared/i18n';
import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { useOutbox } from '@/shared/offline';
import { useSession } from '@/shared/session';
import {
  Button,
  ButtonLink,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  LogoMark,
  Menu,
  MenuItem,
  Segmented,
  StatusBadge,
} from '@/shared/ui';

import { type FeedSort, type PostKind, useFeed } from '../api';
import { CommunityHeader } from './Communities';
import { MobileHubsBar } from './MobileHubsBar';
import { PostCard } from './PostCard';

type KindFilter = 'all' | PostKind;

const SORTS: Array<{ value: FeedSort; label: string; icon: typeof Flame }> = [
  { value: 'hot', label: 'Populaires', icon: Flame },
  { value: 'new', label: 'Nouveaux', icon: Sparkles },
  { value: 'top', label: 'Top', icon: TrendingUp },
];

const KINDS: Array<{ value: KindFilter; label: string; icon: typeof Rows3 }> = [
  { value: 'all', label: 'Tous les formats', icon: Rows3 },
  { value: 'text', label: 'Publications', icon: Newspaper },
  { value: 'poll', label: 'Sondages', icon: BarChart3 },
  { value: 'short', label: 'Vidéos', icon: Clapperboard },
  { value: 'image', label: 'Images', icon: ImageIcon },
];

/** Accueil : en-tête de rubrique, tri et format, posts en cartes ; page de communauté avec ?tag=. */
export function FeedScreen({ aside }: { aside?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { t } = useLang();

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

  const tag = params.get('tag') ?? undefined;
  const kind = (params.get('kind') as KindFilter | null) ?? 'all';
  const sort = (params.get('sort') as FeedSort | null) ?? 'hot';
  const feed = useFeed({ tag, sort, kind: kind === 'all' ? undefined : kind });
  const pending = useOutbox('posts');
  const currentKind = kinds.find((item) => item.value === kind) ?? kinds[0]!;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/feed${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  return (
    <TwoColumns aside={aside}>
      {/* Barre de Hubs et Stories sur Mobile */}
      <MobileHubsBar />

      {tag ? (
        <CommunityHeader tag={tag} />
      ) : (
        <PageHeader
          className="mb-2"
          icon={<Home aria-hidden />}
          title={t('nav.home')}
          description="Astuces, code et discussions des développeurs de la communauté."
        />
      )}
      {!isAuthenticated && !tag ? <WelcomeCard /> : null}

      <Toolbar>
        <Segmented<FeedSort>
          value={sort}
          onChange={(value) => setParam('sort', value === 'hot' ? null : value)}
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
              <MenuItem key={item.value} onSelect={() => setParam('kind', item.value === 'all' ? null : item.value)}>
                <item.icon aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.value === kind ? <Check className="!text-ink" aria-hidden /> : null}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </Toolbar>

      {pending.map((entry) => (
        <div key={entry.id} className="space-y-2 rounded-2xl border border-dashed border-line-strong bg-card p-4">
          <StatusBadge tone="offline">
            <Clock className="size-3" aria-hidden /> {t('settings.outbox.pending')}
          </StatusBadge>
          <p className="font-semibold text-ink">{String(entry.data.title || entry.data.body || '')}</p>
          <p className="text-body-sm text-ink-faint">Sera publié automatiquement au retour de la connexion.</p>
        </div>
      ))}

      {feed.isPending ? (
        <>
          <CardSkeleton />
          <CardSkeleton lines={4} />
        </>
      ) : feed.isError && !feed.items.length ? (
        <ErrorNotice message="Le fil n'est pas encore disponible sur cet appareil. Il s'affichera dès le retour du réseau." />
      ) : !feed.items.length ? (
        <EmptyState
          icon={<Newspaper className="size-7" aria-hidden />}
          title={tag ? `Rien encore dans d/${tag}` : t('feed.empty')}
          action={
            isAuthenticated ? (
              <ButtonLink href={tag ? `/submit?tag=${encodeURIComponent(tag)}` : '/submit'}>
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
              <PostCard post={post} community={!tag} />
            </li>
          ))}
        </ul>
      )}

      {feed.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
          {t('common.see_more')}
        </Button>
      ) : null}
    </TwoColumns>
  );
}

function WelcomeCard() {
  const { t } = useLang();
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center">
      <LogoMark size={48} className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-headline-md text-ink">{t('auth.features_headline')}</h2>
        <p className="text-body-md text-ink-muted">
          {t('auth.features_sub')}
        </p>
      </div>
      <ButtonLink href="/login" className="shrink-0">
        {t('auth.register')}
      </ButtonLink>
    </section>
  );
}
