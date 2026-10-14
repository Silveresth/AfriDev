'use client';

import {
  BarChart3,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Flame,
  Globe,
  Home,
  ImageIcon,
  Newspaper,
  Plus,
  Radio,
  Rows3,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

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

import { type FeedSort, type NewsFilter, type PostKind, useFeed, useTechNews } from '../api';
import { CommunityHeader } from './Communities';
import { MobileHubsBar } from './MobileHubsBar';
import { NewsCard } from './NewsCard';
import { PostCard } from './PostCard';

type TabView = 'community' | 'news';
type KindFilter = 'all' | PostKind;

/** Accueil : fil communautaire et fil d'actualité tech panafricain & mondial. */
export function FeedScreen({ aside }: { aside?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { t } = useLang();

  const tab = (params.get('tab') as TabView | null) ?? 'news';
  const tag = params.get('tag') ?? undefined;
  const kind = (params.get('kind') as KindFilter | null) ?? 'all';
  const sort = (params.get('sort') as FeedSort | null) ?? 'hot';
  const newsFilter = (params.get('source') as NewsFilter | null) ?? 'all';
  const [newsQuery, setNewsQuery] = useState('');

  // Requêtes respectives selon le tab actif
  const feed = useFeed({ tag, sort, kind: kind === 'all' ? undefined : kind });
  const news = useTechNews(newsFilter, newsQuery);
  const pending = useOutbox('posts');

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

  const newsFilters: Array<{ value: NewsFilter; label: string }> = [
    { value: 'all', label: 'Toutes les sources' },
    { value: 'hackernews', label: 'Hacker News' },
    { value: 'devto', label: 'DEV.to' },
    { value: 'rss', label: 'Médias tech' },
    { value: 'fr', label: 'En français' },
  ];

  const currentKind = kinds.find((item) => item.value === kind) ?? kinds[0]!;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/${next.size ? `?${next}` : ''}`, { scroll: false });
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
          description="Astuces, code, retours d'expérience et veille technologique des développeurs."
        />
      )}

      {!isAuthenticated && !tag ? <WelcomeCard /> : null}

      {/* Onglets principaux : Actualités Tech (Veille) vs Communauté */}
      <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
        <Segmented<TabView>
          value={tab}
          onChange={(val) => setParam('tab', val === 'news' ? null : val)}
          options={[
            { value: 'news', label: 'Actu Tech & Veille', icon: <Radio aria-hidden /> },
            { value: 'community', label: 'Discussions Communauté', icon: <Rows3 aria-hidden /> },
          ]}
        />
        {tab === 'community' && isAuthenticated ? (
          <ButtonLink href="/submit" size="sm" variant="primary">
            <Plus className="size-4" aria-hidden /> Nouveau post
          </ButtonLink>
        ) : null}
      </div>

      {tab === 'community' ? (
        <>
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
            <Button variant="ghost" className="w-full mt-3" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
              {t('common.see_more')}
            </Button>
          ) : null}
        </>
      ) : (
        /* Section Actu Tech / Veille */
        <div className="space-y-4">
          <Toolbar>
            <Segmented<NewsFilter>
              value={newsFilter}
              onChange={(value) => setParam('source', value === 'all' ? null : value)}
              options={newsFilters.map((item) => ({ value: item.value, label: item.label }))}
            />
            <div className="ml-auto w-full max-w-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-muted" aria-hidden />
                <input
                  type="search"
                  value={newsQuery}
                  onChange={(e) => setNewsQuery(e.target.value)}
                  placeholder="Filtrer l'actualité tech..."
                  className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-4 text-body-sm text-ink placeholder:text-ink-muted transition-colors focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>
          </Toolbar>

          {news.isPending ? (
            <div className="space-y-3">
              <CardSkeleton lines={3} />
              <CardSkeleton lines={3} />
              <CardSkeleton lines={3} />
              <CardSkeleton lines={3} />
            </div>
          ) : news.isError && !news.data ? (
            <ErrorNotice message="Impossible de charger les actualités externes pour le moment. Veuillez réessayer plus tard." />
          ) : !news.data?.length ? (
            <EmptyState
              icon={<Globe className="size-7" aria-hidden />}
              title="Aucun article trouvé"
            >
              {newsQuery ? 'Aucun résultat ne correspond à votre recherche.' : 'Les flux d’actualités se synchronisent régulièrement.'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {news.data.map((item) => (
                <li key={item.id}>
                  <NewsCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
