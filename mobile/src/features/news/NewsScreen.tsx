import { Newspaper, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { type Key, useT } from '@/shared/i18n';
import { AppearItem } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Chips, EmptyState, ErrorState, Header, IconButton, Loading, Text, TextField } from '@/shared/ui';

import { NEWS_FILTERS, type NewsFilter, useTechNews } from './api';
import { NewsRow } from './NewsRow';

/** Actu tech : Hacker News, DEV et médias (RSS), lus et mis en cache par le serveur AfriDev. */
export function NewsScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const news = useTechNews(filter, query);

  const closeSearch = () => {
    setSearching(false);
    setDraft('');
    setQuery('');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('tab.news')}
        large
        right={
          <IconButton
            icon={searching ? X : Search}
            label={t(searching ? 'news.close_search' : 'news.search')}
            onPress={searching ? closeSearch : () => setSearching(true)}
          />
        }
      />
      {searching ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(160)}
          style={[styles.search, { borderBottomColor: colors.line }]}
        >
          <TextField
            autoFocus
            value={draft}
            onChangeText={setDraft}
            placeholder={t('news.search_ph')}
            returnKeyType="search"
            onSubmitEditing={() => setQuery(draft.trim())}
            autoCapitalize="none"
            icon={Search}
          />
        </Animated.View>
      ) : null}
      <Chips options={NEWS_FILTERS.map((option) => ({ value: option.value, label: t(option.label as Key) }))} value={filter} onChange={setFilter} />

      {news.isPending ? (
        <Loading variant="news" />
      ) : news.isError && !news.data ? (
        <ErrorState error={news.error} onRetry={() => void news.refetch()} />
      ) : (
        <FlatList
          data={news.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AppearItem index={index}>
              <NewsRow item={item} />
            </AppearItem>
          )}
          refreshControl={
            <RefreshControl
              refreshing={news.isRefetching}
              onRefresh={() => void news.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            query ? (
              <Text variant="small" tone="muted" style={styles.caption}>
                {t('news.results', { q: query })}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={Newspaper}
              title={t('news.empty')}
              body={t(query ? 'news.empty_search' : 'news.empty_body')}
            />
          }
          ListFooterComponent={
            news.data?.length ? (
              <Text variant="caption" tone="faint" style={styles.footer}>
                {t('news.footer')}
              </Text>
            ) : null
          }
          contentContainerStyle={styles.grow}
          initialNumToRender={8}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  search: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  caption: { paddingHorizontal: 16, paddingTop: 12 },
  footer: { textAlign: 'center', paddingHorizontal: 32, paddingVertical: 24 },
});
