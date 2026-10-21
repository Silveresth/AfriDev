import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Rows3, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { type Post, PostRow, useFeed } from '@/features/feed';
import { QuestionRow, useQuestions } from '@/features/qa';
import { type PublicSnippet, SnippetRow, useSnippetsByHub } from '@/features/snippets';
import { absoluteUrl, errorMessage, type Schemas } from '@/shared/api';
import { CreateButton } from '@/shared/layout/CreateButton';
import { formatCount, LIST_TUNING } from '@/shared/lib';
import { type Key, useT } from '@/shared/i18n';
import { MoreButton } from '@/features/engage';
import { useRequireAuth, useSession } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { Button, Chips, EmptyState, ErrorState, Header, HubIcon, IconButton, ListFooter, Loading, Text, useToast } from '@/shared/ui';

import { type Hub, useDeleteHub, useHub, useJoinHub } from './api';

type Tab = 'hot' | 'new' | 'questions' | 'snippets';
type Question = Schemas['QuestionOutput'];

const TABS: { value: Tab; label: Key }[] = [
  { value: 'hot', label: 'feed.sort_hot' },
  { value: 'new', label: 'feed.sort_new' },
  { value: 'questions', label: 'hubs.questions' },
  { value: 'snippets', label: 'hubs.snippets' },
];

function HubHeader({ hub, tab, onTab }: { hub: Hub; tab: Tab; onTab: (tab: Tab) => void }) {
  const { colors } = useTheme();
  const { t, tp } = useT();
  const requireAuth = useRequireAuth();
  const join = useJoinHub(hub.slug);
  const member = Boolean(hub.viewer?.is_member);
  const banner = absoluteUrl(hub.banner_url);

  return (
    <View>
      <View style={[styles.banner, { backgroundColor: colors.primary }]}>
        {banner ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={styles.identity}>
        <View style={[styles.iconRing, { backgroundColor: colors.background }]}>
          <HubIcon icon={hub.icon} name={hub.name} size={64} />
        </View>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text variant="title" numberOfLines={1} style={styles.shrink}>
                {hub.name}
              </Text>
              {hub.is_verified ? <BadgeCheck size={18} color={colors.primary} /> : null}
            </View>
            <Text variant="small" tone="muted">
              h/{hub.slug} · {tp('hubs.members', hub.member_count, { count: formatCount(hub.member_count) })}
            </Text>
          </View>
          <Button
            label={t(member ? 'member' : 'hubs.join')}
            variant={member ? 'secondary' : 'primary'}
            size="sm"
            loading={join.isPending}
            onPress={() => requireAuth(() => join.mutate(!member))}
          />
        </View>
        {join.isError ? (
          <Text variant="small" tone="danger">
            {errorMessage(join.error)}
          </Text>
        ) : null}
        {hub.description ? <Text tone="muted">{hub.description}</Text> : null}
        {hub.rules.length ? (
          <View style={[styles.rules, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text variant="smallStrong">{t('hubs.rules')}</Text>
            {hub.rules.slice(0, 5).map((rule, index) => (
              <Text key={index} variant="small" tone="muted">
                {index + 1}. {rule}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      <Chips options={TABS.map((option) => ({ value: option.value, label: t(option.label) }))} value={tab} onChange={onTab} />
    </View>
  );
}

export function HubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const hub = useHub(slug);
  const { user } = useSession();
  const toast = useToast();
  const removeHub = useDeleteHub();
  const [tab, setTab] = useState<Tab>('hot');
  const posts = useFeed({ hub: slug, sort: tab === 'new' ? 'new' : 'hot' }, { enabled: tab === 'hot' || tab === 'new' });
  const questions = useQuestions({ hub: slug }, { enabled: tab === 'questions' });
  const snippets = useSnippetsByHub(slug, tab === 'snippets');
  const list = tab === 'questions' ? questions : tab === 'snippets' ? snippets : posts;

  if (!hub.data) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Header title={`h/${slug}`} back />
        {hub.isPending ? <Loading /> : <ErrorState error={hub.error} onRetry={() => void hub.refetch()} />}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={`h/${hub.data.slug}`}
        back
        right={
          <>
            {hub.data.viewer?.can_manage ? (
              <IconButton icon={UsersRound} label={t('hubs.members_title')} onPress={() => router.push(`/hub-members/${hub.data!.slug}`)} />
            ) : null}
            <MoreButton
              report={hub.data.viewer?.is_creator ? undefined : { type: 'hub', id: hub.data.id }}
              onEdit={hub.data.viewer?.can_manage ? () => router.push({ pathname: '/compose/hub', params: { editSlug: hub.data!.slug } }) : undefined}
              editLabel={t('modify.hub')}
              onDelete={
                hub.data.viewer?.is_creator || user?.is_staff
                  ? () =>
                      removeHub.mutate(hub.data!.slug, {
                        onSuccess: () => {
                          toast(t('mod.deleted'));
                          router.back();
                        },
                        onError: (error) => toast(errorMessage(error), 'error'),
                      })
                  : undefined
              }
            />
          </>
        }
      />
      <FlatList<Post | Question | PublicSnippet>
        {...LIST_TUNING}
        data={list.items as (Post | Question | PublicSnippet)[]}
        keyExtractor={(item) => `${tab}-${item.id}`}
        renderItem={({ item }) =>
          tab === 'questions' ? (
            <QuestionRow question={item as Question} />
          ) : tab === 'snippets' ? (
            <SnippetRow snippet={item as PublicSnippet} />
          ) : (
            <PostRow post={item as Post} showHub={false} />
          )
        }
        ListHeaderComponent={<HubHeader hub={hub.data} tab={tab} onTab={setTab} />}
        onEndReached={list.loadMore}
        refreshControl={
          <RefreshControl
            refreshing={hub.isRefetching}
            onRefresh={() => {
              void hub.refetch();
              void list.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          list.isPending ? (
            <ListFooter loading />
          ) : (
            <EmptyState icon={Rows3} title={t('hubs.empty')} body={t('hubs.empty_body')} />
          )
        }
        ListFooterComponent={<ListFooter loading={list.isFetchingNextPage} />}
        contentContainerStyle={styles.bottom}
      />
      <CreateButton params={{ hubId: hub.data.id, hubName: hub.data.slug }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  bottom: { paddingBottom: 72 },
  banner: { height: 84, overflow: 'hidden' },
  identity: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  iconRing: { marginTop: -32, padding: 3, borderRadius: 18, alignSelf: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rules: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 10, padding: 12, gap: 4 },
});
