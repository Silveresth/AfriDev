import { router } from 'expo-router';
import { ArrowUp, CheckCircle2, ExternalLink, Footprints, FolderGit2, GitPullRequest, RotateCcw, Sparkles, TrendingUp } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, PUBLIC_WEB_URL } from '@/shared/api';
import { type Key, useT } from '@/shared/i18n';
import { openExternal, openLink } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';
import { Button, Chips, Header, Markdown, Text } from '@/shared/ui';

import { type AskAnswer, type AskTurn, type ProfileAction, useAsk, useFirstContributions, useProfileReview } from './api';

type Tool = 'ask' | 'profile' | 'contribute';

/** Assistant IA : « Demande à AfriDev », analyse du profil, premières contributions. */
export function AssistantScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const [tool, setTool] = useState<Tool>('ask');
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header title={t('ai.title')} back />
      <Chips<Tool>
        options={[
          { value: 'ask', label: t('ai.tab.ask') },
          { value: 'profile', label: t('ai.tab.profile') },
          { value: 'contribute', label: t('ai.tab.contribute') },
        ]}
        value={tool}
        onChange={setTool}
      />
      {tool === 'ask' ? <AskTool /> : tool === 'profile' ? <ProfileTool /> : <ContributeTool />}
    </KeyboardAvoidingView>
  );
}

// ── Demande à AfriDev ──

interface Exchange {
  question: string;
  answer?: AskAnswer;
  error?: string;
}

const EXAMPLES: Key[] = ['ai.ask.example1', 'ai.ask.example2', 'ai.ask.example3'];

function AskTool() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const ask = useAsk();
  const scroll = useRef<ScrollView>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState('');

  const patchLast = (values: Partial<Exchange>) =>
    setExchanges((current) => current.map((exchange, i) => (i === current.length - 1 ? { ...exchange, ...values } : exchange)));

  const send = (text: string, base = exchanges) => {
    const question = text.trim();
    if (question.length < 3 || ask.isPending) return;
    haptic.tap();
    const history: AskTurn[] = base
      .filter((exchange) => exchange.answer)
      .flatMap((exchange) => [
        { role: 'user' as const, content: exchange.question },
        { role: 'assistant' as const, content: exchange.answer!.answer.slice(0, 1500) },
      ])
      .slice(-6);
    setExchanges([...base, { question }]);
    setDraft('');
    ask.mutate(
      { question, history },
      { onSuccess: (answer) => patchLast({ answer }), onError: (error) => patchLast({ error: errorMessage(error) }) },
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.chat}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {!exchanges.length ? (
          <View style={[styles.intro, { borderColor: colors.lineStrong }]}>
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Sparkles size={22} color={colors.primaryInk} />
            </View>
            <Text variant="bodyStrong" style={styles.center}>
              {t('ai.ask.empty_title')}
            </Text>
            <Text variant="small" tone="muted" style={styles.center}>
              {t('ai.ask.empty_body')}
            </Text>
            {EXAMPLES.map((key) => (
              <Pressable
                key={key}
                onPress={() => send(t(key))}
                style={({ pressed }) => [styles.example, { borderColor: colors.line, backgroundColor: pressed ? colors.pressed : colors.background }]}
              >
                <Text variant="small" tone="muted">
                  {t(key)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {exchanges.map((exchange, index) => (
          <View key={index} style={styles.exchange}>
            <View style={[styles.mine, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary }}>{exchange.question}</Text>
            </View>
            <View style={[styles.reply, { borderColor: colors.line, backgroundColor: colors.background }]}>
              {exchange.answer ? (
                <>
                  <Markdown source={exchange.answer.answer} />
                  {exchange.answer.sources.length ? (
                    <View style={[styles.sources, { borderTopColor: colors.line }]}>
                      <Text variant="caption" tone="faint" style={styles.upper}>
                        {t('ai.ask.sources')}
                      </Text>
                      {exchange.answer.sources.map((source) => (
                        <Pressable key={source.n} hitSlop={4} onPress={() => void openLink(source.url)}>
                          <Text variant="small" tone="primary" numberOfLines={1}>
                            {`[${source.n}] ${source.title}`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : exchange.error ? (
                <View style={styles.gap}>
                  <Text variant="small" tone="danger">
                    {exchange.error}
                  </Text>
                  <Button
                    label={t('common.retry')}
                    icon={RotateCcw}
                    variant="secondary"
                    size="sm"
                    onPress={() => send(exchange.question, exchanges.slice(0, index))}
                  />
                </View>
              ) : (
                <Text variant="small" tone="muted">
                  {t('ai.ask.thinking')}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.composer, { borderTopColor: colors.line, paddingBottom: insets.bottom + 8, backgroundColor: colors.background }]}>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('ai.ask.placeholder')}
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.primary}
            multiline
            maxLength={1000}
            style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('comment.send')}
            disabled={draft.trim().length < 3 || ask.isPending}
            onPress={() => send(draft)}
            style={[styles.send, { backgroundColor: draft.trim().length >= 3 ? colors.primary : colors.container }]}
          >
            <ArrowUp size={20} color={draft.trim().length >= 3 ? colors.onPrimary : colors.inkFaint} />
          </Pressable>
        </View>
        <Text variant="caption" tone="faint" style={styles.center}>
          {t('ai.ask.disclaimer')}
        </Text>
      </View>
    </View>
  );
}

// ── Analyse du profil ──

const ACTIONS: Record<Exclude<ProfileAction, 'none'>, { label: Key; go: () => void }> = {
  edit_profile: { label: 'ai.action.edit_profile', go: () => router.push('/edit-profile') },
  link_github: { label: 'ai.action.link_github', go: () => router.push('/edit-profile') },
  open_to_work: { label: 'ai.action.open_to_work', go: () => router.push('/edit-profile') },
  pin_content: { label: 'ai.action.pin_content', go: () => router.navigate('/(tabs)/profile') },
  answer_questions: { label: 'ai.action.answer_questions', go: () => router.navigate('/(tabs)/questions') },
  publish_snippet: { label: 'ai.action.publish_snippet', go: () => router.push('/compose/snippet') },
  add_project: { label: 'ai.action.add_project', go: () => void openLink(`${PUBLIC_WEB_URL}/projects/new`) },
};

function ProfileTool() {
  const { colors } = useTheme();
  const { t } = useT();
  const review = useProfileReview();
  const result = review.data;
  const tone = !result ? colors.ink : result.score >= 75 ? colors.secondaryInk : result.score >= 50 ? colors.tertiary : colors.danger;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Intro icon={TrendingUp} title={t('ai.profile.title')} body={t('ai.profile.body')} />
      <Button
        label={t(result ? 'ai.profile.rerun' : 'ai.profile.run')}
        icon={Sparkles}
        block
        loading={review.isPending}
        onPress={() => review.mutate()}
      />
      {review.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(review.error)}
        </Text>
      ) : null}
      {result ? (
        <>
          <View style={[styles.card, styles.scoreRow, { borderColor: colors.line }]}>
            <Text style={[styles.score, { color: tone }]}>{result.score}</Text>
            <Text style={styles.flex}>{result.headline}</Text>
          </View>
          {result.strengths.length ? (
            <View style={[styles.card, { borderColor: colors.line }]}>
              <Text variant="caption" tone="faint" style={styles.upper}>
                {t('ai.profile.strengths')}
              </Text>
              {result.strengths.map((item) => (
                <View key={item} style={styles.inline}>
                  <CheckCircle2 size={16} color={colors.secondaryInk} />
                  <Text variant="small" style={styles.flex}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {result.improvements.length ? (
            <View style={[styles.card, { borderColor: colors.line }]}>
              <Text variant="caption" tone="faint" style={styles.upper}>
                {t('ai.profile.todo')}
              </Text>
              {result.improvements.map((item, index) => {
                const action = item.action !== 'none' ? ACTIONS[item.action] : null;
                return (
                  <View key={index} style={styles.todo}>
                    <View style={[styles.step, { backgroundColor: colors.primary }]}>
                      <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text variant="smallStrong">{item.title}</Text>
                      <Text variant="small" tone="muted">
                        {item.detail}
                      </Text>
                      {action ? (
                        <Pressable hitSlop={6} onPress={action.go}>
                          <Text variant="smallStrong" tone="primary">
                            {`${t(action.label)} →`}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          {result.github.length ? (
            <View style={[styles.card, { borderColor: colors.line }]}>
              <View style={styles.inline}>
                <FolderGit2 size={15} color={colors.inkFaint} />
                <Text variant="caption" tone="faint" style={styles.upper}>
                  {t('ai.profile.github')}
                </Text>
              </View>
              {result.github.map((tip) => (
                <Text key={tip} variant="small">
                  {`• ${tip}`}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

// ── Premières contributions ──

function ContributeTool() {
  const { colors } = useTheme();
  const { t } = useT();
  const search = useFirstContributions();
  const picks = search.data?.picks;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Intro icon={GitPullRequest} title={t('ai.contrib.title')} body={t('ai.contrib.body')} />
      <Button
        label={t(picks ? 'ai.contrib.rerun' : 'ai.contrib.run')}
        icon={Sparkles}
        block
        loading={search.isPending}
        onPress={() => search.mutate()}
      />
      {search.isError ? (
        <Text variant="small" tone="danger">
          {errorMessage(search.error)}
        </Text>
      ) : null}
      {picks && !picks.length ? (
        <Text tone="muted" style={styles.center}>
          {t('ai.contrib.empty')}
        </Text>
      ) : null}
      {picks?.map((pick) => (
        <View key={pick.issue_id} style={[styles.card, { borderColor: colors.line }]}>
          <View style={styles.inline}>
            <Pressable hitSlop={4} onPress={() => router.push(`/project/${pick.project.id}`)}>
              <Text variant="smallStrong" tone="muted">
                {pick.project.name}
              </Text>
            </Pressable>
            <View style={[styles.level, { backgroundColor: pick.level === 'facile' ? colors.secondarySoft : colors.container }]}>
              <Text variant="caption" style={{ color: pick.level === 'facile' ? colors.secondaryInk : colors.inkMuted, fontWeight: '700' }}>
                {t(pick.level === 'facile' ? 'ai.contrib.easy' : 'ai.contrib.medium')}
              </Text>
            </View>
            {pick.labeled ? (
              <Text variant="caption" tone="primary">
                good first issue
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => void openExternal(pick.url, colors.background)} style={styles.inline}>
            <Text variant="bodyStrong" style={styles.flex}>
              <Text variant="bodyStrong" tone="faint">{`#${pick.number} `}</Text>
              {pick.title}
            </Text>
            <ExternalLink size={16} color={colors.primaryInk} />
          </Pressable>
          {pick.why ? (
            <Text variant="small" tone="muted">
              {pick.why}
            </Text>
          ) : null}
          {pick.first_step ? (
            <View style={[styles.firstStep, { backgroundColor: colors.container }]}>
              <Footprints size={15} color={colors.primaryInk} />
              <Text variant="small" style={styles.flex}>
                <Text variant="smallStrong">{`${t('ai.contrib.first_step')} `}</Text>
                {pick.first_step}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function Intro({ icon: Icon, title, body }: { icon: typeof Sparkles; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.introRow}>
      <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
        <Icon size={20} color={colors.primaryInk} />
      </View>
      <View style={styles.flex}>
        <Text variant="headline">{title}</Text>
        <Text variant="small" tone="muted">
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 8 },
  center: { textAlign: 'center' },
  upper: { textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chat: { padding: 16, gap: 16, paddingBottom: 24 },
  intro: { borderWidth: StyleSheet.hairlineWidth * 2, borderStyle: 'dashed', borderRadius: radius.lg, padding: 16, gap: 10, alignItems: 'center' },
  badge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  example: { alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  exchange: { gap: 8 },
  mine: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: radius.lg, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  reply: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.lg, borderTopLeftRadius: 6, padding: 12, gap: 8 },
  sources: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  page: { padding: 16, gap: 14, paddingBottom: 48 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, padding: 14, gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  score: { fontSize: 40, fontWeight: '800' },
  todo: { flexDirection: 'row', gap: 10 },
  step: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  level: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  firstStep: { flexDirection: 'row', gap: 8, borderRadius: radius.sm, padding: 10 },
});
