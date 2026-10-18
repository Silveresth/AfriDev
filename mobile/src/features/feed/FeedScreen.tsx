import { router, useLocalSearchParams } from 'expo-router';
import { Bell, MessageCircle, Rows3, Search, UsersRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { DigestCard } from '@/features/assistant';
import { useUnreadMessages } from '@/features/messaging';
import { useUnreadCount } from '@/features/notifications';
import { CreateButton } from '@/shared/layout/CreateButton';
import { type Key, useT } from '@/shared/i18n';
import { AppearItem, haptic } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Chips, EmptyState, ErrorState, Header, IconButton, ListFooter, Loading, Text } from '@/shared/ui';

import { type HomeFilter, type HomeScope, useHomeFeed } from './api';
import { HomeRow } from './HomeRow';

const FILTERS: HomeFilter[] = ['all', 'posts', 'questions', 'snippets', 'projects', 'jobs'];

/** Accueil : fil mixte « Pour vous » (classé selon vos préférences) ou « Abonnements ». */
export function FeedScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const unread = useUnreadCount();
  const unreadMessages = useUnreadMessages();
  const [scope, setScope] = useState<HomeScope>('for_you');
  const [filter, setFilter] = useState<HomeFilter>('all');
  const feed = useHomeFeed(filter, scope);

  // Lien « /jobs », « /projects »… (résumé du jour, notification) : le fil s'ouvre déjà filtré.
  const params = useLocalSearchParams<{ filter?: string }>();
  useEffect(() => {
    const wanted = params.filter as HomeFilter | undefined;
    if (wanted && FILTERS.includes(wanted)) setFilter(wanted);
  }, [params.filter]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title="AfriDev"
        large
        right={
          <>
            <IconButton icon={Search} label={t('search.title')} onPress={() => router.push('/search')} />
            <IconButton icon={MessageCircle} label={t('dm.title')} badge={unreadMessages.data} onPress={() => router.push('/messages')} />
            <IconButton icon={Bell} label={t('nav.notifications')} badge={unread.data} onPress={() => router.push('/notifications')} />
          </>
        }
      />
      <View style={[styles.scopes, { borderBottomColor: colors.line }]} accessibilityRole="tablist">
        {(['for_you', 'following'] as const).map((value) => {
          const active = scope === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) haptic.select();
                setScope(value);
              }}
              style={[styles.scope, { borderBottomColor: active ? colors.ink : 'transparent' }]}
            >
              <Text variant="smallStrong" tone={active ? 'ink' : 'muted'}>
                {t(value === 'for_you' ? 'home.for_you' : 'home.following')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Chips options={FILTERS.map((value) => ({ value, label: t(`home.filter.${value}` as Key) }))} value={filter} onChange={setFilter} />

      {feed.isPending ? (
        <Loading variant="post" />
      ) : feed.isError && !feed.items.length ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
      ) : (
        <FlatList
          data={feed.items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item, index }) => (
            <AppearItem index={index}>
              <HomeRow item={item} />
            </AppearItem>
          )}
          ListHeaderComponent={scope === 'for_you' && filter === 'all' ? <DigestCard /> : null}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void feed.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            scope === 'following' ? (
              <EmptyState icon={UsersRound} title={t('home.following_empty')} body={t('home.following_empty_body')} />
            ) : (
              <EmptyState icon={Rows3} title={t('feed.empty_title')} body={t('feed.empty_body')} />
            )
          }
          ListFooterComponent={<ListFooter loading={feed.isFetchingNextPage} />}
          contentContainerStyle={styles.grow}
        />
      )}
      <CreateButton />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1, paddingBottom: 72 },
  scopes: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  scope: { height: 42, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 2 },
});
