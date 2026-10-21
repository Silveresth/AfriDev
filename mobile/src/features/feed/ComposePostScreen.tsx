import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3, ImagePlus, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { type MediaAsset, pickFromLibrary, uploadPicked } from '@/shared/media';
import { haptic } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';
import { Button, Header, Tag, Text, TextField, useToast } from '@/shared/ui';
import { VideoPlayer } from '@/shared/video';

import { parseTags, useCreatePost, usePost, useUpdatePost } from './api';

/** Aperçu local du média choisi, affiché pendant l'envoi. */
interface Picked {
  uri: string;
  type: 'image' | 'video';
  ratio: number;
}

export function ComposePostScreen() {
  const { colors } = useTheme();
  const { hubId, hubName, editId = '' } = useLocalSearchParams<{ hubId?: string; hubName?: string; editId?: string }>();
  const create = useCreatePost();
  const update = useUpdatePost(editId);
  const existing = usePost(editId);
  const toast = useToast();
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [poll, setPoll] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const editing = Boolean(editId);
  const saving = create.isPending || update.isPending;
  const failure = create.error ?? update.error;

  const addMedia = async () => {
    if (uploading) return;
    setMediaError(null);
    try {
      const asset = await pickFromLibrary();
      if (!asset) return;
      haptic.tap();
      setMedia(null);
      setPicked({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        ratio: asset.width && asset.height ? Math.min(16 / 9, Math.max(4 / 5, asset.width / asset.height)) : 16 / 9,
      });
      setUploading(true);
      setMedia(await uploadPicked(asset));
      haptic.success();
    } catch (error) {
      setPicked(null);
      setMediaError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };
  const removeMedia = () => {
    setPicked(null);
    setMedia(null);
    setMediaError(null);
  };

  useEffect(() => {
    if (!existing.data || loaded) return;
    setTitle(existing.data.title);
    setBody(existing.data.body);
    setTags(existing.data.tags.join(', '));
    setLoaded(true);
  }, [existing.data, loaded]);

  const options = poll?.map((option) => option.trim()).filter(Boolean) ?? [];
  const pollValid = !poll || options.length >= 2;
  const canPublish = title.trim().length >= 3 && (body.trim() || poll || media || editing) && pollValid && !saving && !uploading;

  const publish = () => {
    if (editing) {
      update.mutate(
        { title: title.trim(), body: body.trim(), tags: parseTags(tags) },
        {
          onSuccess: () => {
            toast(t('modify.saved'));
            router.back();
          },
        },
      );
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        tags: parseTags(tags),
        poll_options: poll ? options : undefined,
        media: media ? { id: media.id, kind: media.kind } : null,
        hub_id: hubId ?? null,
      },
      { onSuccess: (post) => router.replace(`/post/${post.id}`) },
    );
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={t(editing ? 'modify.post' : 'feed.new_post')}
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

        {editing || poll ? null : picked ? (
          <View style={styles.mediaBlock}>
            <View style={[styles.preview, { aspectRatio: picked.ratio, backgroundColor: colors.container }]}>
              {picked.type === 'video' ? (
                <VideoPlayer uri={picked.uri} style={StyleSheet.absoluteFill} autoPlay={false} compact />
              ) : (
                <Image source={{ uri: picked.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('compose.media_remove')}
                hitSlop={8}
                onPress={removeMedia}
                style={styles.removeMedia}
              >
                <X size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={styles.mediaStatus}>
              {uploading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              <Text variant="small" tone="muted" style={styles.flex}>
                {uploading
                  ? t('compose.media_uploading')
                  : media?.kind === 'video' && media.status !== 'ready'
                    ? t('compose.media_processing')
                    : ''}
              </Text>
              {uploading ? null : <Button label={t('compose.media_change')} variant="ghost" size="sm" onPress={() => void addMedia()} />}
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => void addMedia()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addMedia, { borderColor: colors.lineStrong }, pressed && { backgroundColor: colors.pressed }]}
          >
            <View style={[styles.mediaIcon, { backgroundColor: colors.primarySoft }]}>
              <ImagePlus size={22} color={colors.primaryInk} />
            </View>
            <View style={styles.flex}>
              <Text variant="smallStrong">{t('compose.media_add')}</Text>
              <Text variant="caption" tone="muted">
                {t('compose.media_hint')}
              </Text>
            </View>
          </Pressable>
        )}
        {mediaError ? (
          <Text variant="small" tone="danger">
            {mediaError}
          </Text>
        ) : null}

        {editing || picked ? null : poll ? (
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
  mediaBlock: { gap: 8 },
  preview: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  mediaStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  addMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
  mediaIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
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
