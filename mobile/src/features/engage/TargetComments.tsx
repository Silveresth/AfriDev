import { router } from 'expo-router';
import { Flag, Reply, SendHorizontal, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Button, ListFooter, MentionText, ProfileAvatar, Text, useMentions, useToast } from '@/shared/ui';

import { REPORT_REASONS, type TargetComment, type TargetType, useReport, useTargetCommentActions, useTargetComments } from './api';

/** Discussion sous un projet ou une offre : commentaires, réponses, suppression, signalement. */
export function TargetComments({ type, id, ownerId }: { type: TargetType; id: string; ownerId?: string | null }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const { user, isAuthenticated } = useSession();
  const comments = useTargetComments(type, id);
  const { send, remove } = useTargetCommentActions(type, id);
  const report = useReport();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<TargetComment | null>(null);
  const mentions = useMentions(body, setBody);
  const text = body.trim();
  const roots = comments.items.filter((comment) => !comment.parent_id);
  const repliesOf = (parentId: string) => comments.items.filter((comment) => comment.parent_id === parentId);

  const actions = (comment: TargetComment) => {
    const mine = Boolean(user && (comment.author?.id === user.id || ownerId === user.id || user.is_staff));
    if (mine) {
      Alert.alert(t('act.delete_title'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(comment.id, { onError: (e) => toast(errorMessage(e), 'error') }) },
      ]);
      return;
    }
    Alert.alert(t('act.report_title'), undefined, [
      ...REPORT_REASONS.slice(0, 2).map((reason) => ({
        text: t(`act.reason.${reason}`),
        onPress: () =>
          report.mutate(
            { type: 'target_comment', id: comment.id, reason },
            { onSuccess: () => toast(t('act.reported')), onError: (e) => toast(errorMessage(e), 'error') },
          ),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const row = (comment: TargetComment, nested = false) => {
    const name = comment.author?.display_name || comment.author?.username || t('member');
    const canDelete = Boolean(user && (comment.author?.id === user.id || ownerId === user.id || user.is_staff));
    return (
      <View key={comment.id} style={[styles.comment, nested && styles.nested]}>
        <ProfileAvatar author={comment.author} size={nested ? 28 : 34} />
        <View style={styles.flex}>
          <View style={[styles.bubble, { backgroundColor: colors.container }]}>
            <Text variant="caption">
              <Text variant="caption" style={styles.strong}>
                {name}
              </Text>
              <Text variant="caption" tone="faint">{` · ${timeAgo(comment.created_at)}`}</Text>
            </Text>
            <MentionText text={comment.body} />
          </View>
          <View style={styles.tools}>
            {isAuthenticated && !nested ? (
              <Pressable hitSlop={8} onPress={() => setReplyTo(comment)} style={styles.tool}>
                <Reply size={14} color={colors.inkFaint} />
                <Text variant="caption" tone="faint">
                  {t('dm.reply')}
                </Text>
              </Pressable>
            ) : null}
            {isAuthenticated && (canDelete || comment.author?.id !== user?.id) ? (
              <Pressable hitSlop={8} onPress={() => actions(comment)} style={styles.tool}>
                {canDelete ? <Trash2 size={14} color={colors.inkFaint} /> : <Flag size={14} color={colors.inkFaint} />}
                <Text variant="caption" tone="faint">
                  {canDelete ? t('common.delete') : t('feed.report')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {!nested ? repliesOf(comment.id).map((reply) => row(reply, true)) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.section, { borderTopColor: colors.line }]}>
      <Text variant="headline">
        {t('act.comments_title')}{' '}
        <Text variant="body" tone="faint">
          {comments.items.length}
        </Text>
      </Text>
      {comments.isPending ? (
        <ListFooter loading />
      ) : roots.length ? (
        roots.map((comment) => row(comment))
      ) : (
        <Text variant="small" tone="muted">
          {t('act.first_comment')}
        </Text>
      )}
      {comments.hasNextPage ? <Button label={t('act.see_all')} variant="ghost" size="sm" onPress={comments.loadMore} /> : null}

      {isAuthenticated ? (
        <View style={styles.composer}>
          {replyTo ? (
            <View style={[styles.replying, { backgroundColor: colors.surface }]}>
              <Reply size={14} color={colors.primary} />
              <Text variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
                {t('comment.replying', { user: replyTo.author?.username ?? t('member') })}
              </Text>
              <Pressable hitSlop={8} onPress={() => setReplyTo(null)}>
                <X size={14} color={colors.inkFaint} />
              </Pressable>
            </View>
          ) : null}
          {send.error ? (
            <Text variant="caption" tone="danger">
              {errorMessage(send.error)}
            </Text>
          ) : null}
          {mentions.suggestions}
          <View style={styles.inputRow}>
            <TextInput
              value={body}
              onChangeText={mentions.onChangeText}
              onSelectionChange={mentions.onSelectionChange}
              placeholder={t('comment.placeholder')}
              placeholderTextColor={colors.inkFaint}
              selectionColor={colors.primary}
              multiline
              maxLength={2000}
              style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('comment.send')}
              disabled={!text || send.isPending}
              onPress={() =>
                send.mutate(
                  { body: text, parent_id: replyTo?.id },
                  {
                    onSuccess: () => {
                      haptic.success();
                      setBody('');
                      setReplyTo(null);
                    },
                  },
                )
              }
              style={[styles.send, { backgroundColor: text ? colors.primary : colors.container }]}
            >
              <SendHorizontal size={18} color={text ? colors.onPrimary : colors.inkFaint} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Button label={t('auth.login')} variant="secondary" block onPress={() => router.push('/login')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '700' },
  section: { gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  comment: { flexDirection: 'row', gap: 10 },
  nested: { marginTop: 8 },
  bubble: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  tools: { flexDirection: 'row', gap: 14, paddingTop: 4, paddingLeft: 4 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  composer: { gap: 6, paddingTop: 4 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: radius.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 110, minHeight: 42, borderRadius: 21, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
