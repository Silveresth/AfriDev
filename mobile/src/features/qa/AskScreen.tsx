import { router, useLocalSearchParams } from 'expo-router';
import { Lightbulb } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { parseTags } from '@/features/feed/api';
import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';
import { Button, ForwardChevron, Header, Tag, Text, TextField, useToast } from '@/shared/ui';

import { useAskQuestion, useQuestion, useSimilarQuestions, useUpdateQuestion } from './api';

/** Question : avant de publier, on montre les questions déjà résolues qui ressemblent. */
export function AskScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const { hubId, hubName, editId = '' } = useLocalSearchParams<{ hubId?: string; hubName?: string; editId?: string }>();
  const ask = useAskQuestion();
  const update = useUpdateQuestion(editId);
  const existing = useQuestion(editId);
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [probe, setProbe] = useState('');
  const [loaded, setLoaded] = useState(false);
  const editing = Boolean(editId);
  const saving = ask.isPending || update.isPending;
  const failure = ask.error ?? update.error;
  const similar = useSimilarQuestions(editing ? '' : probe);

  useEffect(() => {
    if (!existing.data || loaded) return;
    setTitle(existing.data.title);
    setBody(existing.data.body);
    setTags(existing.data.tags.join(', '));
    setLoaded(true);
  }, [existing.data, loaded]);

  useEffect(() => {
    const timer = setTimeout(() => setProbe(title.trim()), 600);
    return () => clearTimeout(timer);
  }, [title]);

  const canPublish = title.trim().length >= 10 && body.trim().length >= 10 && !saving;
  const publish = () => {
    const input = { title: title.trim(), body: body.trim(), tags: parseTags(tags) };
    if (editing) {
      update.mutate(input, {
        onSuccess: () => {
          toast(t('modify.saved'));
          router.back();
        },
      });
      return;
    }
    ask.mutate({ ...input, hub_id: hubId ?? null }, { onSuccess: (question) => router.replace(`/question/${question.id}`) });
  };

  const matches = (similar.data ?? []).slice(0, 3);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t(editing ? 'modify.question' : 'ask.title')}
        close
        right={
          <Button
            label={t(editing ? 'common.save' : 'compose.publish')}
            size="sm"
            disabled={!canPublish}
            loading={saving}
            onPress={publish}
            style={styles.publish}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {hubName ? (
          <View style={styles.hub}>
            <Text variant="small" tone="muted">
              {t('ask.in_hub')}
            </Text>
            <Tag label={`h/${hubName}`} tone="primary" />
          </View>
        ) : null}
        <TextField
          label={t('compose.title')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('ask.title_ph')}
          maxLength={200}
          hint={t('ask.title_hint')}
        />

        {matches.length ? (
          <View style={[styles.similar, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.similarHead}>
              <Lightbulb size={16} color={colors.tertiary} />
              <Text variant="smallStrong">{t('ask.similar')}</Text>
            </View>
            {matches.map((match) => (
              <Pressable
                key={`${match.source_type}-${match.source_id}`}
                disabled={match.source_type !== 'question'}
                onPress={() => router.push(`/question/${match.source_id}`)}
                style={styles.match}
              >
                <Text variant="small" style={styles.flex} numberOfLines={2}>
                  {match.title}
                </Text>
                {match.source_type === 'question' ? <ForwardChevron size={16} color={colors.inkFaint} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextField
          label={t('ask.details')}
          value={body}
          onChangeText={setBody}
          placeholder={t('ask.details_ph')}
          multiline
          maxLength={10000}
          hint={t('ask.details_hint')}
        />
        <TextField
          label={t('compose.tags')}
          value={tags}
          onChangeText={setTags}
          placeholder={t('ask.tags_ph')}
          autoCapitalize="none"
          hint={t('compose.tags_hint')}
        />
        {failure ? (
          <Text variant="small" tone="danger">
            {errorMessage(failure)}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  publish: { marginRight: 8 },
  form: { padding: 16, gap: 18, paddingBottom: 48 },
  hub: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  similar: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, padding: 12, gap: 8 },
  similarHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
