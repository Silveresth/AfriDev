import { Activity, Rows3 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { type Post, PostRow, useFeed } from '@/features/feed';
import { QuestionRow, useQuestions } from '@/features/qa';
import type { Schemas } from '@/shared/api';
import { type Key, useT } from '@/shared/i18n';
import { AppearItem } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Chips, EmptyState, ListFooter, Text } from '@/shared/ui';

import { ProjectRow, SnippetRow } from './ActivityRows';
import { type MyProfile, type Project, type PublicProfile, type PublicSnippet, useProjectsByOwner, useSnippetsByAuthor } from './api';
import { AboutSection, BadgesSection, CompletionCard, GitHubSection, PinnedSection, ProfileHero, QrCard } from './sections';

type Question = Schemas['QuestionOutput'];
type Tab = 'posts' | 'questions' | 'snippets' | 'projects';
type Item = Post | Question | PublicSnippet | Project;

const TABS: { value: Tab; label: Key }[] = [
  { value: 'posts', label: 'feed.filter_posts' },
  { value: 'questions', label: 'profile.tab.questions' },
  { value: 'snippets', label: 'nav.snippets' },
  { value: 'projects', label: 'nav.projects' },
];

const EMPTY: Record<Tab, Key> = {
  posts: 'profile.empty.posts',
  questions: 'profile.empty.questions',
  snippets: 'profile.empty.snippets',
  projects: 'profile.empty.projects',
};

function Header({ profile, me, tab, onTab }: { profile: PublicProfile; me?: MyProfile; tab: Tab; onTab: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={styles.header}>
      <ProfileHero profile={profile} isMe={Boolean(me)} />
      {me ? <CompletionCard profile={me} /> : null}
      <PinnedSection profile={profile} me={me} />
      <AboutSection profile={profile} me={me} />
      <GitHubSection profile={profile} />
      <BadgesSection profile={profile} />
      <QrCard profile={profile} />
      <View style={styles.activity}>
        <Activity size={18} color={colors.inkFaint} />
        <Text variant="headline">{t('profile.activity')}</Text>
      </View>
      <Chips options={TABS.map((option) => ({ value: option.value, label: t(option.label) }))} value={tab} onChange={onTab} />
    </View>
  );
}

/**
 * Page de profil, au plus près du web : identité, chiffres de réputation, épinglés, bio (et bio IA),
 * compétences endossées, GitHub, badges, carte QR, puis activité en 4 onglets.
 */
export function ProfileView({ profile, me, onRefresh }: { profile: PublicProfile; me?: MyProfile; onRefresh?: () => void }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('posts');
  const { t } = useT();
  const posts = useFeed({ author: profile.id, sort: 'new' });
  const questions = useQuestions({ author: profile.id }, { enabled: tab === 'questions' });
  const snippets = useSnippetsByAuthor(profile.id, tab === 'snippets');
  const projects = useProjectsByOwner(profile.id, tab === 'projects');
  const list = { posts, questions, snippets, projects }[tab];

  const render = (item: Item) => {
    if (tab === 'questions') return <QuestionRow question={item as Question} />;
    if (tab === 'snippets') return <SnippetRow snippet={item as PublicSnippet} />;
    if (tab === 'projects') return <ProjectRow project={item as Project} />;
    return <PostRow post={item as Post} />;
  };

  return (
    <FlatList<Item>
      data={list.items as Item[]}
      keyExtractor={(item) => `${tab}-${item.id}`}
      renderItem={({ item, index }) => <AppearItem index={index}>{render(item)}</AppearItem>}
      ListHeaderComponent={<Header profile={profile} me={me} tab={tab} onTab={setTab} />}
      onEndReached={list.loadMore}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => {
            onRefresh?.();
            void list.refetch();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      ListEmptyComponent={list.isPending ? <ListFooter loading /> : <EmptyState icon={Rows3} title={t(EMPTY[tab])} />}
      ListFooterComponent={<ListFooter loading={list.isFetchingNextPage} />}
      contentContainerStyle={styles.bottom}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: 14 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  bottom: { paddingBottom: 40 },
});
