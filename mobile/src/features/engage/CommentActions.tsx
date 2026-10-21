import type { QueryKey } from '@tanstack/react-query';
import { Flag, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useRequireAuth, useSession } from '@/shared/session';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { type CommentTarget, useCommentVote, type Votable } from './api';
import { MoreSheet } from './MoreSheet';

/**
 * Sous un commentaire : 👍 score 👎 (retoucher le même pouce retire le vote) et signaler.
 * `listKey` : liste paginée qui affiche le commentaire (mise à jour immédiate).
 */
export function CommentActions({
  type,
  comment,
  listKey,
  authorId,
  children,
}: {
  type: CommentTarget;
  comment: Votable;
  listKey: QueryKey;
  /** Auteur du commentaire : pas de signalement sur son propre commentaire. */
  authorId?: string | null;
  /** Actions propres à l'écran (Répondre…), affichées à la suite. */
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const requireAuth = useRequireAuth();
  const vote = useCommentVote(type, comment, listKey);
  const [reporting, setReporting] = useState(false);
  const value = comment.viewer_vote ?? 0;
  const tint = value === 1 ? colors.primary : value === -1 ? colors.downvote : colors.inkMuted;
  const mine = Boolean(user && authorId && user.id === authorId);

  const cast = (next: 1 | -1) =>
    requireAuth(() => {
      haptic.tap();
      vote.mutate(value === next ? 0 : next);
    });

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comment.upvote')}
        accessibilityState={{ selected: value === 1 }}
        hitSlop={8}
        onPress={() => cast(1)}
        style={styles.icon}
      >
        <ThumbsUp size={15} color={value === 1 ? tint : colors.inkMuted} fill={value === 1 ? tint : 'transparent'} />
      </Pressable>
      <Text variant="caption" style={[styles.score, { color: value ? tint : colors.inkMuted }]}>
        {formatCount(comment.score ?? 0)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comment.downvote')}
        accessibilityState={{ selected: value === -1 }}
        hitSlop={8}
        onPress={() => cast(-1)}
        style={styles.icon}
      >
        <ThumbsDown size={15} color={value === -1 ? tint : colors.inkMuted} fill={value === -1 ? tint : 'transparent'} />
      </Pressable>
      {children}
      {mine ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comment.report')}
          hitSlop={8}
          onPress={() => requireAuth(() => setReporting(true))}
          style={styles.icon}
        >
          <Flag size={14} color={colors.inkFaint} />
        </Pressable>
      )}
      {/* Toujours monté (rien n'est rendu fermé) : le message « signalé » s'affiche après la fermeture. */}
      {mine ? null : <MoreSheet report={{ type, id: comment.id }} reportOnly visible={reporting} onClose={() => setReporting(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  score: { minWidth: 14, textAlign: 'center', fontWeight: '700' },
});
