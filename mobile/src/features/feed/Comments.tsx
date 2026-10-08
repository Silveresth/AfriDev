import { router } from 'expo-router';
import { SendHorizontal, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TranslateBar } from '@/features/translation';
import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { timeAgo } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { radius, typography, useTheme } from '@/shared/theme';
import { Avatar, Button, Text } from '@/shared/ui';

import { type Comment, useSendComment } from './api';

export interface ThreadRow {
  comment: Comment;
  depth: number;
}

/** Arbre des réponses aplati dans l'ordre de lecture (indentation plafonnée à 3 niveaux). */
export function threadRows(comments: Comment[]): ThreadRow[] {
  const children = new Map<string | null, Comment[]>();
  const ids = new Set(comments.map((comment) => comment.id));
  for (const comment of comments) {
    // Parent absent de la page chargée : la réponse remonte au premier niveau.
    const parent = comment.parent_id && ids.has(comment.parent_id) ? comment.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), comment]);
  }
  const rows: ThreadRow[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const comment of children.get(parent) ?? []) {
      rows.push({ comment, depth: Math.min(depth, 3) });
      walk(comment.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export function CommentRow({ row, onReply }: { row: ThreadRow; onReply: (comment: Comment) => void }) {
  const { colors } = useTheme();
  const { comment, depth } = row;
  const { t } = useT();
  const author = comment.author;
  const name = author?.display_name || author?.username || t('member');
  return (
    <View style={[styles.comment, { marginLeft: 16 + depth * 14 }, depth ? { borderLeftColor: colors.line, borderLeftWidth: 2, paddingLeft: 12 } : null]}>
      <View style={styles.byline}>
        <Avatar name={name} src={author?.avatar_url} size={22} />
        <Text variant="caption" style={styles.strong} onPress={author ? () => router.push(`/u/${author.username}`) : undefined}>
          {name}
        </Text>
        <Text variant="caption" tone="faint">
          {timeAgo(comment.created_at)}
        </Text>
      </View>
      <Text selectable>{comment.body}</Text>
      <TranslateBar text={comment.body} compact />
      <Pressable hitSlop={8} onPress={() => onReply(comment)} style={styles.reply}>
        <Text variant="caption" tone="muted">
          {t('comment.reply')}
        </Text>
      </Pressable>
    </View>
  );
}

/** Barre de saisie collée en bas de l'écran (au-dessus du clavier). */
export function CommentComposer({
  postId,
  replyTo,
  onCancelReply,
}: {
  postId: string;
  replyTo: Comment | null;
  onCancelReply: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useSession();
  const send = useSendComment(postId);
  const { t } = useT();
  const [body, setBody] = useState('');

  const bar = [styles.bar, { borderTopColor: colors.line, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }];

  if (!isAuthenticated) {
    return (
      <View style={bar}>
        <Button label={t('auth.login')} variant="secondary" block onPress={() => router.push('/login')} />
      </View>
    );
  }

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    send.mutate(
      { body: text, parentId: replyTo?.id },
      {
        onSuccess: () => {
          setBody('');
          onCancelReply();
        },
      },
    );
  };

  return (
    <View style={bar}>
      {replyTo ? (
        <View style={styles.replying}>
          <Text variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
            {t('comment.replying', { user: replyTo.author?.username ?? t('member') })}
          </Text>
          <Pressable hitSlop={8} onPress={onCancelReply} accessibilityLabel={t('comment.cancel_reply')}>
            <X size={16} color={colors.inkMuted} />
          </Pressable>
        </View>
      ) : null}
      {send.isError ? (
        <Text variant="caption" tone="danger">
          {errorMessage(send.error)}
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t(replyTo ? 'comment.reply_placeholder' : 'comment.placeholder')}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.primary}
          multiline
          style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.container }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comment.send')}
          disabled={!body.trim() || send.isPending}
          onPress={submit}
          style={[styles.send, { backgroundColor: body.trim() ? colors.primary : colors.container }]}
        >
          <SendHorizontal size={18} color={body.trim() ? colors.onPrimary : colors.inkFaint} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  comment: { paddingRight: 16, paddingVertical: 10, gap: 6 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strong: { fontWeight: '700' },
  reply: { alignSelf: 'flex-start' },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  replying: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, minHeight: 42, borderRadius: radius.lg + 7, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
