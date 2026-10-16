import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { parseTags } from '@/features/feed';
import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { languageColor } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { mono, radius, useTheme } from '@/shared/theme';
import { Button, Header, Switch, Tag, Text, TextField, useToast } from '@/shared/ui';

import { LANGUAGES, useCreateSnippet } from './api';

/** Publier un snippet depuis l'appli (public par défaut, dans le hub d'où l'on publie). */
export function ComposeSnippetScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { hubId, hubName } = useLocalSearchParams<{ hubId?: string; hubName?: string }>();
  const create = useCreateSnippet();
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<string>('python');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const canPublish = title.trim().length >= 3 && content.trim().length >= 1 && !create.isPending;

  const publish = () =>
    create.mutate(
      { title: title.trim(), language, content, tags: parseTags(tags), is_public: isPublic, hub_id: hubId ?? null },
      {
        onSuccess: (snippet) => {
          haptic.success();
          if (isPublic) router.replace(`/snippet/${snippet.id}`);
          else {
            toast(t('snippet.saved_private'));
            router.back();
          }
        },
      },
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t('snippet.new')}
        close
        right={<Button label={t('compose.publish')} size="sm" disabled={!canPublish} loading={create.isPending} onPress={publish} style={styles.publish} />}
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {hubName ? (
          <View style={styles.inline}>
            <Text variant="small" tone="muted">
              {t('compose.in_hub')}
            </Text>
            <Tag label={`h/${hubName}`} tone="primary" />
          </View>
        ) : null}
        <TextField label={t('compose.title')} value={title} onChangeText={setTitle} placeholder={t('snippet.title_ph')} maxLength={200} />

        <View style={styles.group}>
          <Text variant="smallStrong">{t('snippet.language')}</Text>
          <View style={styles.languages}>
            {LANGUAGES.map((value) => {
              const active = value === language;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    haptic.select();
                    setLanguage(value);
                  }}
                  style={[
                    styles.language,
                    { borderColor: active ? colors.ink : colors.lineStrong, backgroundColor: active ? colors.ink : colors.background },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: languageColor(value) }]} />
                  <Text variant="caption" style={{ color: active ? colors.background : colors.inkMuted, fontWeight: '600' }}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField
          label={t('snippet.code')}
          value={content}
          onChangeText={setContent}
          placeholder={t('snippet.code_ph')}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          maxLength={20000}
          style={styles.code}
        />
        <TextField
          label={t('compose.tags')}
          value={tags}
          onChangeText={setTags}
          placeholder="django, wave-api"
          autoCapitalize="none"
          hint={t('compose.tags_hint')}
        />
        <View style={[styles.toggle, { borderColor: colors.line }]}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('snippet.public')}</Text>
            <Text variant="small" tone="muted">
              {t('snippet.public_hint')}
            </Text>
          </View>
          <Switch label={t('snippet.public')} value={isPublic} onChange={setIsPublic} />
        </View>
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
  flex: { flex: 1, gap: 2 },
  publish: { marginRight: 8 },
  form: { padding: 16, gap: 18, paddingBottom: 48 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  group: { gap: 8 },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  language: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  code: { fontFamily: mono, fontSize: 13, minHeight: 180 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
});
