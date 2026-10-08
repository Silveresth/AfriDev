import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Rows3 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { type Post, PostRow, useFeed } from '@/features/feed';
import { QuestionRow, useQuestions } from '@/features/qa';
import { absoluteUrl, errorMessage, type Schemas } from '@/shared/api';
import { CreateButton } from '@/shared/layout/CreateButton';
import { formatCount } from '@/shared/lib';
import { type Key, useT } from '@/shared/i18n';
import { AppearItem } from '@/shared/motion';
import { useRequireAuth } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { Button, Chips, EmptyState, ErrorState, Header, HubIcon, ListFooter, Loading, Text } from '@/shared/ui';

import { type Hub, useHub, useJoinHub } from './api';

type Tab = 'hot' | 'new' | 'questions';
type Question = Schemas['QuestionOutput'];

const TABS: { value: Tab; label: Key }[] = [
  { value: 'hot', label: 'feed.sort_hot' },
  { value: 'new', label: 'feed.sort_new' },
  { value: 'questions', label: 'hubs.questions' },
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
  const [tab, setTab] = useState<Tab>('hot');
  const posts = useFeed({ hub: slug, sort: tab === 'new' ? 'new' : 'hot' });
  const questions = useQuestions({ hub: slug }, { enabled: tab === 'questions' });
  const list = tab === 'questions' ? questions : posts;

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
      <Header title={`h/${hub.data.slug}`} back />
      <FlatList<Post | Question>
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <AppearItem index={index}>
            {tab === 'questions' ? <QuestionRow question={item as Question} /> : <PostRow post={item as Post} showHub={false} />}
          </AppearItem>
        )}
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
