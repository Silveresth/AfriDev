import { router } from 'expo-router';
import { Bell, Rows3 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useUnreadCount } from '@/features/notifications';
import { CreateButton } from '@/shared/layout/CreateButton';
import { useT } from '@/shared/i18n';
import { AppearItem } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Chips, EmptyState, ErrorState, Header, IconButton, ListFooter, Loading } from '@/shared/ui';

import { type FeedSort, SORTS, useFeed } from './api';
import { PostRow } from './PostRow';

export function FeedScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const unread = useUnreadCount();
  const [sort, setSort] = useState<FeedSort>('hot');
  const feed = useFeed({ sort });

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title="AfriDev"
        large
        right={<IconButton icon={Bell} label={t('nav.notifications')} badge={unread.data} onPress={() => router.push('/notifications')} />}
      />
      <Chips options={SORTS.map((option) => ({ value: option.value, label: t(option.label) }))} value={sort} onChange={setSort} />

      {feed.isPending ? (
        <Loading variant="post" />
      ) : feed.isError && !feed.items.length ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
      ) : (
        <FlatList
          data={feed.items}
          keyExtractor={(post) => post.id}
          renderItem={({ item, index }) => (
            <AppearItem index={index}>
              <PostRow post={item} />
            </AppearItem>
          )}
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
            <EmptyState icon={Rows3} title={t('feed.empty_title')} body={t('feed.empty_body')} />
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
  login: { marginRight: 8 },
});
