import { router, useLocalSearchParams } from 'expo-router';
import { ArrowBigDown, ArrowBigUp, Check, CheckCircle2, SendHorizontal, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TranslateBar } from '@/features/translation';
import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { openLink, timeAgo } from '@/shared/lib';
import { useRequireAuth, useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, ErrorState, Header, Loading, Markdown, TagRow, Text } from '@/shared/ui';

import { type Answer, type Question, useAnswerActions, useAnswers, useQuestion } from './api';

function AiAnswer({ question }: { question: Question }) {
  const { colors } = useTheme();
  const { t } = useT();
  if (question.ai_answer_status === 'disabled' || (!question.ai_answer && question.ai_answer_status !== 'pending')) return null;
  return (
    <View style={[styles.ai, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <View style={styles.aiHead}>
        <View style={[styles.aiIcon, { backgroundColor: colors.tertiarySoft }]}>
          <Sparkles size={14} color={colors.tertiary} />
        </View>
        <Text variant="smallStrong">{t('qa.ai_title')}</Text>
      </View>
      {question.ai_answer_status === 'pending' ? (
        <View style={styles.aiPending}>
          <ActivityIndicator size="small" color={colors.tertiary} />
          <Text variant="small" tone="muted">
            {t('qa.ai_pending')}
          </Text>
        </View>
      ) : question.ai_answer ? (
        <>
          <Markdown source={question.ai_answer} />
          {question.ai_answer_sources.length ? (
            <View style={styles.sources}>
              <Text variant="caption" tone="faint">
                {t('qa.sources')}
              </Text>
              {question.ai_answer_sources.map((source) => (
                <Text
                  key={`${source.source_type}-${source.source_id}`}
                  variant="small"
                  tone="primary"
                  numberOfLines={1}
                  onPress={() => (/^https?:/.test(source.url) ? void openLink(source.url) : undefined)}
                >
                  {source.title}
                </Text>
              ))}
            </View>
          ) : null}
          <Text variant="caption" tone="faint">
            {t('qa.ai_disclaimer')}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function AnswerRow({ answer, question }: { answer: Answer; question: Question }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const requireAuth = useRequireAuth();
  const { accept, vote } = useAnswerActions(question.id);
  const author = answer.author;
  const name = author?.display_name || author?.username || t('member');
  const canAccept = Boolean(user && question.author?.id === user.id && !answer.is_accepted);

  return (
    <View style={[styles.answer, { borderBottomColor: colors.line }]}>
      <View style={styles.voteCol}>
        <Pressable hitSlop={6} accessibilityLabel={t('feed.upvote')} onPress={() => requireAuth(() => vote.mutate({ answerId: answer.id, value: 1 }))}>
          <ArrowBigUp size={24} color={colors.inkMuted} strokeWidth={1.8} />
        </Pressable>
        <Text variant="bodyStrong">{answer.score}</Text>
        <Pressable hitSlop={6} accessibilityLabel={t('feed.downvote')} onPress={() => requireAuth(() => vote.mutate({ answerId: answer.id, value: -1 }))}>
          <ArrowBigDown size={24} color={colors.inkMuted} strokeWidth={1.8} />
        </Pressable>
        {answer.is_accepted ? <CheckCircle2 size={22} color={colors.secondary} style={styles.accepted} /> : null}
      </View>
      <View style={styles.answerBody}>
        {answer.is_accepted ? (
          <Text variant="caption" tone="secondary" style={styles.strong}>
            {t('qa.accepted')}
          </Text>
        ) : null}
        <Markdown source={answer.body} />
        <TranslateBar text={answer.body} />
        <View style={styles.byline}>
          <Avatar name={name} src={author?.avatar_url} size={20} />
          <Text variant="caption" tone="muted" onPress={author ? () => router.push(`/u/${author.username}`) : undefined}>
            {name} · {timeAgo(answer.created_at)}
          </Text>
        </View>
        {canAccept ? (
          <Button
            label={t('qa.accept')}
            icon={Check}
            variant="secondary"
            size="sm"
            loading={accept.isPending}
            onPress={() => accept.mutate(answer.id)}
            style={styles.acceptButton}
          />
        ) : null}
      </View>
    </View>
  );
}

function AnswerComposer({ questionId }: { questionId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useSession();
  const { create } = useAnswerActions(questionId);
  const [body, setBody] = useState('');
  const bar = [styles.bar, { borderTopColor: colors.line, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }];

  if (!isAuthenticated) {
    return (
      <View style={bar}>
        <Button label={t('qa.login_to_answer')} variant="secondary" block onPress={() => router.push('/login')} />
      </View>
    );
  }
  const ready = body.trim().length >= 2 && !create.isPending;
  return (
    <View style={bar}>
      {create.isError ? (
        <Text variant="caption" tone="danger">
          {errorMessage(create.error)}
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('qa.answer_ph')}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.primary}
          multiline
          style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('qa.publish_answer')}
          disabled={!ready}
          onPress={() => create.mutate(body.trim(), { onSuccess: () => setBody('') })}
          style={[styles.send, { backgroundColor: ready ? colors.primary : colors.container }]}
        >
          <SendHorizontal size={18} color={ready ? colors.onPrimary : colors.inkFaint} />
        </Pressable>
      </View>
    </View>
  );
}

export function QuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, tp } = useT();
  const question = useQuestion(id);
  const answers = useAnswers(id);

  if (question.isPending) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Header title={t('qa.question')} back />
        <Loading />
      </View>
    );
  }
  if (!question.data) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Header title={t('qa.question')} back />
        <ErrorState error={question.error} onRetry={() => void question.refetch()} />
      </View>
    );
  }

  const data = question.data;
  const author = data.author;
  const name = author?.display_name || author?.username || t('member');
  const rows = answers.data ?? [];

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={data.hub ? `h/${data.hub.slug}` : t('qa.question')} back />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={[styles.question, { borderBottomColor: colors.line }]}>
          <View style={styles.byline}>
            <Avatar name={name} src={author?.avatar_url} size={22} />
            <Text variant="caption" tone="muted" onPress={author ? () => router.push(`/u/${author.username}`) : undefined}>
              {name} · {timeAgo(data.created_at)}
            </Text>
            {data.is_resolved ? (
              <View style={[styles.resolved, { backgroundColor: colors.secondarySoft }]}>
                <Text variant="caption" tone="secondary">
                  {t('qa.resolved_badge')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="title">{data.title}</Text>
          <Markdown source={data.body} />
          <TranslateBar text={`${data.title}\n\n${data.body}`} />
          <TagRow tags={data.tags} max={5} />
          <AiAnswer question={data} />
        </View>
        <Text variant="smallStrong" tone="muted" style={styles.section}>
          {rows.length ? tp('qa.answers', rows.length) : t('qa.no_answers')}
        </Text>
        {rows.map((answer) => (
          <AnswerRow key={answer.id} answer={answer} question={data} />
        ))}
      </ScrollView>
      <AnswerComposer questionId={id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  question: { padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolved: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  ai: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, padding: 14, gap: 10, marginTop: 4 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  aiPending: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sources: { gap: 4 },
  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  answer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  voteCol: { alignItems: 'center', width: 32, gap: 2 },
  accepted: { marginTop: 6 },
  answerBody: { flex: 1, gap: 10 },
  strong: { fontWeight: '700' },
  acceptButton: { alignSelf: 'flex-start' },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 140, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
