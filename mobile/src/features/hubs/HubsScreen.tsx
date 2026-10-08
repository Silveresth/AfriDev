import { router } from 'expo-router';
import { BadgeCheck, Search, UsersRound } from 'lucide-react-native';
import { memo, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { AppearItem } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Chips, EmptyState, ErrorState, Header, HubIcon, ListFooter, Loading, Text } from '@/shared/ui';

import { type Hub, HUB_SORTS, type HubSort, useHubs } from './api';

const HubRow = memo(function HubRow({ hub }: { hub: Hub }) {
  const { colors } = useTheme();
  const { t, tp } = useT();
  return (
    <Pressable
      onPress={() => router.push(`/h/${hub.slug}`)}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.pressed }]}
    >
      <HubIcon icon={hub.icon} name={hub.name} size={44} />
      <View style={styles.body}>
        <View style={styles.title}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            h/{hub.slug}
          </Text>
          {hub.is_verified ? <BadgeCheck size={16} color={colors.primary} /> : null}
        </View>
        {hub.description ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {hub.description}
          </Text>
        ) : null}
        <Text variant="caption" tone="faint">
          {tp('hubs.members', hub.member_count, { count: formatCount(hub.member_count) })}
          {hub.target_country ? ` · ${hub.target_country}` : ''}
          {hub.viewer?.is_member ? ` · ${t('member')}` : ''}
        </Text>
      </View>
    </Pressable>
  );
});

export function HubsScreen() {
  const { colors } = useTheme();
  const { t, tp } = useT();
  const { isAuthenticated } = useSession();
  const [sort, setSort] = useState<HubSort>('popular');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const options = (isAuthenticated ? HUB_SORTS : HUB_SORTS.filter((option) => option.value !== 'mine')).map((option) => ({
    value: option.value,
    label: t(option.label),
  }));
  const hubs = useHubs(sort, q);

  useEffect(() => {
    const timer = setTimeout(() => setQ(draft.trim()), 400);
    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={t('nav.hubs')} large />
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.container }]}>
          <Search size={18} color={colors.inkFaint} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('hubs.search_ph')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            autoCapitalize="none"
            style={[typography.body, styles.input, { color: colors.ink }]}
          />
        </View>
      </View>
      <Chips options={options} value={sort} onChange={setSort} />
      {hubs.isPending ? (
        <Loading variant="row" />
      ) : hubs.isError && !hubs.items.length ? (
        <ErrorState error={hubs.error} onRetry={() => void hubs.refetch()} />
      ) : (
        <FlatList
          data={hubs.items}
          keyExtractor={(hub) => hub.id}
          renderItem={({ item, index }) => (
            <AppearItem index={index}>
              <HubRow hub={item} />
            </AppearItem>
          )}
          onEndReached={hubs.loadMore}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={hubs.isRefetching && !hubs.isFetchingNextPage}
              onRefresh={() => void hubs.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            hubs.items.length && !q ? (
              <Text variant="caption" tone="faint" style={styles.caption}>
                {sort === 'mine' ? tp('hubs.joined', hubs.items.length) : t('hubs.tagline')}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={UsersRound}
              title={t(sort === 'mine' ? 'hubs.none_joined' : 'hubs.none')}
              body={sort === 'mine' ? t('hubs.none_joined_body') : undefined}
            />
          }
          ListFooterComponent={<ListFooter loading={hubs.isFetchingNextPage} />}
          contentContainerStyle={styles.grow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.pill, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 0 },
  caption: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, gap: 3 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
