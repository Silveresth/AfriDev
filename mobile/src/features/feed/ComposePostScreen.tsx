import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';
import { Button, Header, Tag, Text, TextField } from '@/shared/ui';

import { parseTags, useCreatePost } from './api';

export function ComposePostScreen() {
  const { colors } = useTheme();
  const { hubId, hubName } = useLocalSearchParams<{ hubId?: string; hubName?: string }>();
  const create = useCreatePost();
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [poll, setPoll] = useState<string[] | null>(null);

  const options = poll?.map((option) => option.trim()).filter(Boolean) ?? [];
  const pollValid = !poll || options.length >= 2;
  const canPublish = title.trim().length >= 3 && (body.trim() || poll) && pollValid && !create.isPending;

  const publish = () =>
    create.mutate(
      { title: title.trim(), body: body.trim(), tags: parseTags(tags), poll_options: poll ? options : undefined, hub_id: hubId ?? null },
      { onSuccess: (post) => router.replace(`/post/${post.id}`) },
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('feed.new_post')}
        close
        right={<Button label={t('compose.publish')} size="sm" disabled={!canPublish} loading={create.isPending} onPress={publish} style={styles.publish} />}
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {hubName ? (
          <View style={styles.hub}>
            <Text variant="small" tone="muted">
              {t('compose.in_hub')}
            </Text>
            <Tag label={`h/${hubName}`} tone="primary" />
          </View>
        ) : null}
        <TextField label={t('compose.title')} value={title} onChangeText={setTitle} placeholder={t('compose.title_ph')} maxLength={200} />
        <TextField
          label={t('compose.text')}
          value={body}
          onChangeText={setBody}
          placeholder={t('compose.text_ph')}
          multiline
          maxLength={3000}
          hint={`${body.length} / 3000`}
        />

        {poll ? (
          <View style={[styles.poll, { borderColor: colors.line }]}>
            <View style={styles.pollHead}>
              <Text variant="smallStrong">{t('compose.poll')}</Text>
              <Pressable hitSlop={8} onPress={() => setPoll(null)} accessibilityLabel={t('compose.remove_poll')}>
                <X size={18} color={colors.inkMuted} />
              </Pressable>
            </View>
            {poll.map((option, index) => (
              <TextField
                key={index}
                value={option}
                onChangeText={(text) => setPoll(poll.map((value, i) => (i === index ? text : value)))}
                placeholder={t('compose.option', { n: index + 1 })}
                maxLength={80}
              />
            ))}
            {poll.length < 4 ? (
              <Button label={t('compose.add_option')} icon={Plus} variant="ghost" size="sm" onPress={() => setPoll([...poll, ''])} />
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setPoll(['', ''])}
            style={({ pressed }) => [styles.addPoll, { borderColor: colors.lineStrong }, pressed && { backgroundColor: colors.pressed }]}
          >
            <BarChart3 size={18} color={colors.inkMuted} />
            <Text variant="smallStrong" tone="muted">
              {t('compose.add_poll')}
            </Text>
          </Pressable>
        )}

        <TextField
          label={t('compose.tags')}
          value={tags}
          onChangeText={setTags}
          placeholder="django, mobile-money, flutter"
          autoCapitalize="none"
          hint={t('compose.tags_hint')}
        />
        {create.isError ? (
          <Text variant="small" tone="danger">
            {errorMessage(create.error)}
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
  poll: { gap: 10, padding: 14, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md },
  pollHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addPoll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
});
