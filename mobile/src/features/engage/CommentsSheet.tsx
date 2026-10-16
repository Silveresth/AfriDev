import { router } from 'expo-router';
import { SendHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { useComments, useSendComment } from '@/features/feed/api';
import { useAnswerActions, useAnswers } from '@/features/qa/api';
import { useAddSnippetComment, useSnippetComments } from '@/features/snippets/api';
import { errorMessage, type Schemas } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, ListFooter, Sheet, Text } from '@/shared/ui';

export type ThreadKind = 'post' | 'snippet' | 'question';

interface Line {
  id: string;
  author: Schemas['Author'] | null;
  body: string;
  created_at: string;
}

interface ThreadProps {
  title: string;
  lines: Line[];
  loading: boolean;
  empty: string;
  placeholder: string;
  sending: boolean;
  error: unknown;
  onSend: (body: string, done: () => void) => void;
  onSeeAll: () => void;
}

const DETAIL: Record<ThreadKind, (id: string) => string> = {
  post: (id) => `/post/${id}`,
  snippet: (id) => `/snippet/${id}`,
  question: (id) => `/question/${id}`,
};

/** Commentaires (post, snippet) ou réponses (question) dans une feuille, sans quitter le fil. */
export function CommentsSheet({ kind, id, visible, onClose }: { kind: ThreadKind; id: string; visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  const seeAll = () => {
    onClose();
    router.push(DETAIL[kind](id) as never);
  };
  const Body = kind === 'post' ? PostThread : kind === 'snippet' ? SnippetThread : AnswerThread;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Body id={id} onSeeAll={seeAll} />
    </Sheet>
  );
}

function PostThread({ id, onSeeAll }: { id: string; onSeeAll: () => void }) {
  const { t } = useT();
  const comments = useComments(id);
  const send = useSendComment(id);
  return (
    <Thread
      title={t('act.comments_title')}
      lines={comments.items}
      loading={comments.isPending}
      empty={t('act.first_comment')}
      placeholder={t('comment.placeholder')}
      sending={send.isPending}
      error={send.error}
      onSend={(body, done) => send.mutate({ body }, { onSuccess: done })}
      onSeeAll={onSeeAll}
    />
  );
}

function SnippetThread({ id, onSeeAll }: { id: string; onSeeAll: () => void }) {
  const { t } = useT();
  const comments = useSnippetComments(id);
  const send = useAddSnippetComment(id);
  return (
    <Thread
      title={t('act.comments_title')}
      lines={comments.items}
      loading={comments.isPending}
      empty={t('act.first_comment')}
      placeholder={t('comment.placeholder')}
      sending={send.isPending}
      error={send.error}
      onSend={(body, done) => send.mutate(body, { onSuccess: done })}
      onSeeAll={onSeeAll}
    />
  );
}

function AnswerThread({ id, onSeeAll }: { id: string; onSeeAll: () => void }) {
  const { t } = useT();
  const answers = useAnswers(id);
  const { create } = useAnswerActions(id);
  return (
    <Thread
      title={t('act.answers_title')}
      lines={answers.data ?? []}
      loading={answers.isPending}
      empty={t('act.first_answer')}
      placeholder={t('act.answer_ph')}
      sending={create.isPending}
      error={create.error}
      onSend={(body, done) => create.mutate(body, { onSuccess: done })}
      onSeeAll={onSeeAll}
    />
  );
}

function Thread({ title, lines, loading, empty, placeholder, sending, error, onSend, onSeeAll }: ThreadProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const { height } = useWindowDimensions();
  const { isAuthenticated } = useSession();
  const [body, setBody] = useState('');
  const text = body.trim();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.head}>
        <Text variant="headline" style={styles.flex}>
          {title}
        </Text>
        <Pressable hitSlop={8} onPress={onSeeAll}>
          <Text variant="smallStrong" tone="primary">
            {t('act.see_all')}
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={lines}
        keyExtractor={(line) => line.id}
        style={{ maxHeight: height * 0.45 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <LineRow line={item} />}
        ListEmptyComponent={
          loading ? (
            <ListFooter loading />
          ) : (
            <Text variant="small" tone="muted" style={styles.empty}>
              {empty}
            </Text>
          )
        }
      />
      <View style={[styles.bar, { borderTopColor: colors.line }]}>
        {!isAuthenticated ? (
          <Button label={t('auth.login')} variant="secondary" block onPress={() => router.push('/login')} />
        ) : (
          <>
            {error ? (
              <Text variant="caption" tone="danger">
                {errorMessage(error)}
              </Text>
            ) : null}
            <View style={styles.inputRow}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={placeholder}
                placeholderTextColor={colors.inkFaint}
                selectionColor={colors.primary}
                multiline
                style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comment.send')}
                disabled={!text || sending}
                onPress={() => onSend(text, () => setBody(''))}
                style={[styles.send, { backgroundColor: text ? colors.primary : colors.container }]}
              >
                <SendHorizontal size={18} color={text ? colors.onPrimary : colors.inkFaint} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function LineRow({ line }: { line: Line }) {
  const { t } = useT();
  const name = line.author?.display_name || line.author?.username || t('member');
  return (
    <View style={styles.line}>
      <Avatar name={name} src={line.author?.avatar_url} size={28} />
      <View style={styles.flex}>
        <Text variant="caption">
          <Text variant="caption" style={styles.strong}>
            {name}
          </Text>
          <Text variant="caption" tone="faint">
            {` · ${timeAgo(line.created_at)}`}
          </Text>
        </Text>
        <Text variant="small" numberOfLines={6}>
          {line.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  strong: { fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  empty: { paddingHorizontal: 20, paddingVertical: 16 },
  line: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 8 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 110, minHeight: 42, borderRadius: radius.lg + 7, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
