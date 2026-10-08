import { MessagesSquare, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { CreateButton } from '@/shared/layout/CreateButton';
import { useT } from '@/shared/i18n';
import { AppearItem } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';
import { Chips, EmptyState, ErrorState, Header, ListFooter, Loading } from '@/shared/ui';

import { type QuestionStatus, STATUSES, useQuestions } from './api';
import { QuestionRow } from './QuestionRow';

export function QuestionsScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const [status, setStatus] = useState<QuestionStatus>('all');
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const questions = useQuestions({ status, q });

  // Recherche lancée 400 ms après la dernière frappe (économise la data).
  useEffect(() => {
    const timer = setTimeout(() => setQ(draft.trim()), 400);
    return () => clearTimeout(timer);
  }, [draft]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={t('tab.qa')} large />
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.container }]}>
          <Search size={18} color={colors.inkFaint} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('qa.search_ph')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            returnKeyType="search"
            style={[typography.body, styles.input, { color: colors.ink }]}
          />
        </View>
      </View>
      <Chips options={STATUSES.map((option) => ({ value: option.value, label: t(option.label) }))} value={status} onChange={setStatus} />

      {questions.isPending ? (
        <Loading variant="row" />
      ) : questions.isError && !questions.items.length ? (
        <ErrorState error={questions.error} onRetry={() => void questions.refetch()} />
      ) : (
        <FlatList
          data={questions.items}
          keyExtractor={(question) => question.id}
          renderItem={({ item, index }) => (
            <AppearItem index={index}>
              <QuestionRow question={item} />
            </AppearItem>
          )}
          onEndReached={questions.loadMore}
          onEndReachedThreshold={0.6}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={questions.isRefetching && !questions.isFetchingNextPage}
              onRefresh={() => void questions.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={MessagesSquare}
              title={t(q ? 'qa.no_result' : 'qa.empty')}
              body={q ? t('qa.no_result_body') : undefined}
            />
          }
          ListFooterComponent={<ListFooter loading={questions.isFetchingNextPage} />}
          contentContainerStyle={styles.grow}
        />
      )}
      <CreateButton href="/compose/question" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1, paddingBottom: 72 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.pill, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 0 },
});
