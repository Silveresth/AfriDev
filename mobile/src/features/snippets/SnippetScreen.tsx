import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Copy, SendHorizontal, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { languageColor, timeAgo } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { typography, useTheme } from '@/shared/theme';
import {
  Avatar,
  Button,
  CodeBlock,
  ErrorState,
  Header,
  HubIcon,
  HubRoleBadge,
  IconButton,
  ListFooter,
  Loading,
  TagRow,
  Text,
  useToast,
} from '@/shared/ui';

import { type PublicSnippet, useAddSnippetComment, useDeleteSnippet, usePublicSnippet, useSnippetComments } from './api';

function Comments({ snippetId }: { snippetId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const comments = useSnippetComments(snippetId);
  return (
    <View style={styles.comments}>
      <Text variant="smallStrong" tone="muted">
        {t('snippet.comments')}
      </Text>
      {comments.isPending ? (
        <ListFooter loading />
      ) : !comments.items.length ? (
        <Text variant="small" tone="faint">
          {t('snippet.no_comments')}
        </Text>
      ) : (
        comments.items.map((comment) => {
          const name = comment.author?.display_name || comment.author?.username || t('member');
          return (
            <View key={comment.id} style={[styles.comment, { borderBottomColor: colors.line }]}>
              <Avatar name={name} src={comment.author?.avatar_url} size={26} />
              <View style={styles.flex}>
                <Text variant="caption" tone="muted">
                  <Text variant="caption" style={styles.strong}>
                    {name}
                  </Text>
                  {` · ${timeAgo(comment.created_at)}`}
                </Text>
                <Text variant="small">{comment.body}</Text>
              </View>
            </View>
          );
        })
      )}
      {comments.hasNextPage ? (
        <Button label={t('common.see_more')} variant="ghost" size="sm" loading={comments.isFetchingNextPage} onPress={comments.loadMore} />
      ) : null}
    </View>
  );
}

function CommentComposer({ snippetId }: { snippetId: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useSession();
  const add = useAddSnippetComment(snippetId);
  const toast = useToast();
  const [body, setBody] = useState('');
  if (!isAuthenticated) return null;
  const ready = body.trim().length >= 2 && !add.isPending;
  return (
    <View style={[styles.bar, { borderTopColor: colors.line, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t('snippet.comment_ph')}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.primary}
        multiline
        style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('compose.publish')}
        disabled={!ready}
        onPress={() =>
          add.mutate(body.trim(), {
            onSuccess: () => setBody(''),
            onError: (error) => toast(errorMessage(error), 'error'),
          })
        }
        style={[styles.send, { backgroundColor: ready ? colors.primary : colors.container }]}
      >
        <SendHorizontal size={18} color={ready ? colors.onPrimary : colors.inkFaint} />
      </Pressable>
    </View>
  );
}

function SnippetBody({ snippet }: { snippet: PublicSnippet }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const author = snippet.author;
  const name = author?.display_name || author?.username || t('member');
  const lines = snippet.content.split('\n').length;

  return (
    <View style={[styles.body, { borderBottomColor: colors.line }]}>
      <View style={styles.inline}>
        <View style={[styles.dot, { backgroundColor: languageColor(snippet.language) }]} />
        <Text variant="caption" tone="muted">
          {snippet.language} · {t('snippet.lines', { count: lines })}
        </Text>
        {snippet.hub ? (
          <Pressable onPress={() => router.push(`/h/${snippet.hub!.slug}`)} style={styles.inline} hitSlop={6}>
            <HubIcon icon={snippet.hub.icon} name={snippet.hub.name} size={16} />
            <Text variant="caption" style={styles.strong}>
              h/{snippet.hub.slug}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text variant="title">{snippet.title}</Text>
      <View style={styles.inline}>
        <Avatar name={name} src={author?.avatar_url} size={22} />
        <Text variant="caption" tone="muted" onPress={author ? () => router.push(`/u/${author.username}`) : undefined}>
          <Text variant="caption" style={styles.strong}>
            {name}
          </Text>
          {` · ${timeAgo(snippet.published_at)}`}
        </Text>
        <HubRoleBadge role={snippet.author_role} />
      </View>
      <CodeBlock code={snippet.content} />
      <Button
        label={t('snippet.copy')}
        icon={Copy}
        variant="secondary"
        size="sm"
        onPress={async () => {
          await Clipboard.setStringAsync(snippet.content);
          haptic.success();
          toast(t('snippet.copied'));
        }}
        style={styles.copy}
      />
      <TagRow tags={snippet.tags} max={6} />
    </View>
  );
}

/** Snippet public dans l'appli : code complet, copie en un toucher, commentaires. */
export function SnippetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const snippet = usePublicSnippet(id);
  const remove = useDeleteSnippet();
  const toast = useToast();

  const data = snippet.data;
  const mine = Boolean(user && data?.author?.id === user.id);
  const confirmDelete = () =>
    Alert.alert(t('common.delete'), mine ? t('snippet.delete_confirm') : t('mod.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => {
              toast(t('snippet.deleted'));
              router.back();
            },
            onError: (error) => toast(errorMessage(error), 'error'),
          }),
      },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <Header
        title={data?.hub ? `h/${data.hub.slug}` : 'Snippet'}
        back
        right={mine || data?.can_moderate ? <IconButton icon={Trash2} label={t('common.delete')} color={colors.danger} onPress={confirmDelete} /> : null}
      />
      {snippet.isPending ? (
        <Loading />
      ) : !data ? (
        <ErrorState error={snippet.error} onRetry={() => void snippet.refetch()} />
      ) : (
        <>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.scroll}>
            <SnippetBody snippet={data} />
            <Comments snippetId={id} />
          </ScrollView>
          <CommentComposer snippetId={id} />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  scroll: { paddingBottom: 24 },
  body: { padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  strong: { fontWeight: '700' },
  copy: { alignSelf: 'flex-start' },
  comments: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  comment: { flexDirection: 'row', gap: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

