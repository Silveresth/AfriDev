import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThumbsUp, CheckCircle2, Clapperboard, HandHelping, LayoutGrid, type LucideIcon, Play, Rows3, Sparkles } from 'lucide-react-native';
import { memo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { type Post, PostRow, useFeed } from '@/features/feed';
import { QuestionRow, useQuestions } from '@/features/qa';
import { absoluteUrl, type Schemas } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { type Key, useT } from '@/shared/i18n';
import { formatCount, timeAgo } from '@/shared/lib';
import { AppearItem, PressableScale } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Chips, EmptyState, ListFooter, Text } from '@/shared/ui';

import { ProjectRow, SnippetRow } from './ActivityRows';
import {
  type HelpAnswer,
  type MyProfile,
  type Project,
  type PublicProfile,
  type PublicSnippet,
  useAuthorAnswers,
  useProjectsByOwner,
  useSnippetsByAuthor,
} from './api';
import { ProfileHeader } from './ProfileHeader';
import { AiBioCard, BadgesSection, CompletionCard, CraftSection, GitHubSection, PinnedSection, QrCard, StackSection } from './sections';

type Question = Schemas['QuestionOutput'];
type Tab = 'creations' | 'videos' | 'help' | 'craft';
type Creation = 'posts' | 'snippets' | 'projects';
type Help = 'accepted' | 'answers' | 'questions';
type Item = Post | Question | PublicSnippet | Project | HelpAnswer;
type VideoMedia = { thumbhash?: string; duration_seconds?: number | null; urls?: { poster?: string } };

const TABS: { value: Tab; label: Key; icon: LucideIcon }[] = [
  { value: 'creations', label: 'profile.tab.creations', icon: LayoutGrid },
  { value: 'videos', label: 'profile.tab.videos', icon: Clapperboard },
  { value: 'help', label: 'profile.tab.help', icon: HandHelping },
  { value: 'craft', label: 'profile.tab.craft', icon: Sparkles },
];

const EMPTY: Record<Creation | Help | 'videos', Key> = {
  posts: 'profile.empty.posts',
  snippets: 'profile.empty.snippets',
  projects: 'profile.empty.projects',
  accepted: 'profile.empty.help',
  answers: 'profile.empty.answers',
  questions: 'profile.empty.questions',
  videos: 'profile.empty.videos',
};

/** Onglets soulignés, défilants, avec icônes. */
function TabBar({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <FlatList
      horizontal
      data={TABS}
      keyExtractor={(tab) => tab.value}
      showsHorizontalScrollIndicator={false}
      style={[styles.tabs, { borderBottomColor: colors.line }]}
      contentContainerStyle={styles.tabsInner}
      renderItem={({ item }) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <PressableScale
            scaleTo={0.95}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.value)}
            style={[styles.tab, { borderBottomColor: active ? colors.ink : 'transparent' }]}
          >
            <Icon size={16} color={active ? colors.primary : colors.inkFaint} />
            <Text variant="smallStrong" tone={active ? 'ink' : 'muted'}>
              {t(item.label)}
            </Text>
          </PressableScale>
        );
      }}
    />
  );
}

/** Miniature verticale 9:16 d'une vidéo courte (affiche WebP, aperçu ThumbHash instantané). */
const VideoTile = memo(function VideoTile({ post, width }: { post: Post; width: number }) {
  const { colors } = useTheme();
  const { textOnly } = useDataSaver();
  const media = post.media as VideoMedia | null;
  const poster = textOnly ? undefined : absoluteUrl(media?.urls?.poster);
  return (
    <PressableScale scaleTo={0.97} onPress={() => router.push(`/post/${post.id}`)} style={[styles.video, { width, backgroundColor: colors.container }]}>
      <Image
        source={poster ? { uri: poster } : undefined}
        placeholder={media?.thumbhash ? { thumbhash: media.thumbhash } : undefined}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
      <View style={styles.videoShade} />
      <View style={styles.videoPlay}>
        <Play size={14} color="#FFFFFF" />
      </View>
      <View style={styles.videoInfo}>
        <Text variant="smallStrong" numberOfLines={2} style={styles.onDark}>
          {post.title || post.body}
        </Text>
        <View style={styles.inline}>
          <ThumbsUp size={13} color="#FFFFFFCC" />
          <Text variant="caption" style={styles.onDarkMuted}>
            {formatCount(post.score)}
            {media?.duration_seconds ? `  ·  ${Math.round(media.duration_seconds)} s` : ''}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});

/** Réponse donnée par le membre (historique d'entraide). */
const HelpRow = memo(function HelpRow({ answer }: { answer: HelpAnswer }) {
  const { colors } = useTheme();
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push(`/question/${answer.question_id}`)} style={[styles.help, { borderBottomColor: colors.line }]}>
      <View style={[styles.helpIcon, { backgroundColor: answer.is_accepted ? colors.secondarySoft : colors.container }]}>
        {answer.is_accepted ? <CheckCircle2 size={16} color={colors.secondaryInk} /> : <HandHelping size={16} color={colors.inkFaint} />}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {answer.question_title}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {answer.excerpt}
        </Text>
        <Text variant="caption" tone="faint">
          ↑ {formatCount(answer.score)} · {timeAgo(answer.created_at)}
        </Text>
      </View>
    </PressableScale>
  );
});

function Header({
  profile,
  me,
  tab,
  onTab,
  creation,
  onCreation,
  help,
  onHelp,
}: {
  profile: PublicProfile;
  me?: MyProfile;
  tab: Tab;
  onTab: (tab: Tab) => void;
  creation: Creation;
  onCreation: (value: Creation) => void;
  help: Help;
  onHelp: (value: Help) => void;
}) {
  const { t } = useT();
  return (
    <View style={styles.header}>
      <ProfileHeader profile={profile} isMe={Boolean(me)} />
      {me ? <CompletionCard profile={me} /> : null}
      {me ? <AiBioCard me={me} /> : null}
      <TabBar value={tab} onChange={onTab} />
      {tab === 'creations' ? (
        <>
          <PinnedSection profile={profile} me={me} />
          <Chips
            options={[
              { value: 'posts', label: t('feed.filter_posts') },
              { value: 'snippets', label: t('nav.snippets') },
              { value: 'projects', label: t('nav.projects') },
            ]}
            value={creation}
            onChange={onCreation}
          />
        </>
      ) : null}
      {tab === 'help' ? (
        <Chips
          options={[
            { value: 'accepted', label: t('profile.help.accepted') },
            { value: 'answers', label: t('profile.help.answers') },
            { value: 'questions', label: t('profile.help.questions') },
          ]}
          value={help}
          onChange={onHelp}
        />
      ) : null}
      {tab === 'craft' ? (
        <>
          <CraftSection profile={profile} />
          <BadgesSection profile={profile} />
          <StackSection profile={profile} isMe={Boolean(me)} />
          <GitHubSection profile={profile} />
          <QrCard profile={profile} />
        </>
      ) : null}
    </View>
  );
}

/**
 * Profil immersif : en-tête (bannière, avatar centré, abonnés / Craft, suivre, bio, réseaux),
 * puis 4 onglets : Snippets & Posts, Vidéos & Tutos (grille 9:16), Q&A & Entraide, Craft & Stack.
 * Seule la liste de l'onglet affiché est chargée.
 */
export function ProfileView({ profile, me, onRefresh }: { profile: PublicProfile; me?: MyProfile; onRefresh?: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('creations');
  const [creation, setCreation] = useState<Creation>('posts');
  const [help, setHelp] = useState<Help>('accepted');

  const showing = (value: Tab, sub?: string, current?: string) => tab === value && (!sub || sub === current);
  const posts = useFeed({ author: profile.id, sort: 'new' }, { enabled: showing('creations', 'posts', creation) });
  const videos = useFeed({ author: profile.id, media: 'video', sort: 'new' }, { enabled: showing('videos') });
  const snippets = useSnippetsByAuthor(profile.id, showing('creations', 'snippets', creation));
  const projects = useProjectsByOwner(profile.id, showing('creations', 'projects', creation));
  const answers = useAuthorAnswers(profile.id, help === 'accepted' ? true : undefined, showing('help') && help !== 'questions');
  const questions = useQuestions({ author: profile.id }, { enabled: showing('help', 'questions', help) });

  const sub = tab === 'creations' ? creation : tab === 'help' ? help : tab;
  const list =
    tab === 'craft'
      ? null
      : tab === 'videos'
        ? videos
        : tab === 'creations'
          ? { posts, snippets, projects }[creation]
          : help === 'questions'
            ? questions
            : answers;

  const isGrid = tab === 'videos';
  const tileWidth = (width - 16 * 2 - 8) / 2;

  const render = (item: Item) => {
    if (tab === 'videos') return <VideoTile post={item as Post} width={tileWidth} />;
    if (tab === 'help') return help === 'questions' ? <QuestionRow question={item as Question} /> : <HelpRow answer={item as HelpAnswer} />;
    if (creation === 'snippets') return <SnippetRow snippet={item as PublicSnippet} />;
    if (creation === 'projects') return <ProjectRow project={item as Project} />;
    return <PostRow post={item as Post} />;
  };

  return (
    <FlatList<Item>
      // Changer de nombre de colonnes impose de recréer la liste.
      key={isGrid ? 'grid' : 'list'}
      numColumns={isGrid ? 2 : 1}
      columnWrapperStyle={isGrid ? styles.gridRow : undefined}
      data={(list?.items ?? []) as Item[]}
      keyExtractor={(item) => `${tab}-${sub}-${item.id}`}
      renderItem={({ item, index }) => (isGrid ? render(item) : <AppearItem index={index}>{render(item)}</AppearItem>)}
      ListHeaderComponent={
        <Header profile={profile} me={me} tab={tab} onTab={setTab} creation={creation} onCreation={setCreation} help={help} onHelp={setHelp} />
      }
      onEndReached={list?.loadMore}
      refreshControl={
        <RefreshControl
          refreshing={Boolean(list?.isRefetching && !list.isFetchingNextPage)}
          onRefresh={() => {
            onRefresh?.();
            void list?.refetch();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      ListEmptyComponent={
        !list ? null : list.isPending ? (
          <ListFooter loading />
        ) : (
          <EmptyState icon={tab === 'videos' ? Clapperboard : Rows3} title={t(EMPTY[sub as keyof typeof EMPTY])} />
        )
      }
      ListFooterComponent={<ListFooter loading={Boolean(list?.isFetchingNextPage)} />}
      contentContainerStyle={styles.bottom}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  header: { gap: 14, paddingBottom: 6 },
  bottom: { paddingBottom: 40 },
  tabs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsInner: { paddingHorizontal: 12, gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 10, borderBottomWidth: 2 },
  gridRow: { gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  video: { aspectRatio: 9 / 16, borderRadius: 14, overflow: 'hidden' },
  videoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  videoPlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoInfo: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, gap: 4 },
  onDark: { color: '#FFFFFF' },
  onDarkMuted: { color: '#FFFFFFCC' },
  help: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  helpIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
