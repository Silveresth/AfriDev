import { Bookmark, MessageSquare, MoreHorizontal, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScoreCapsule } from '@/features/feed/VoteCapsule';
import { errorMessage } from '@/shared/api';
import { useT } from '@/shared/i18n';
import { formatCount } from '@/shared/lib';
import { haptic } from '@/shared/motion';
import { useRequireAuth } from '@/shared/session';
import { radius, useTheme } from '@/shared/theme';
import { Text, useToast } from '@/shared/ui';

import { SaveSheet } from '@/features/bookmarks';

import { type SaveType, shareContent, useSavedIn, useToggleSave } from './api';
import { CommentsSheet, type ThreadKind } from './CommentsSheet';
import { type MoreActions, MoreSheet } from './MoreSheet';

export interface ActionBarProps {
  vote?: { score: number; value: number; onVote: (value: -1 | 0 | 1) => void };
  /** Fil de discussion ouvert dans une feuille ; absent = pas de commentaires (projet). */
  thread?: { kind: ThreadKind; id: string; count: number };
  share: { title: string; path: string };
  save?: { type: SaveType; id: string };
  more?: MoreActions;
}

/** Voter, commenter, partager, enregistrer et « … » directement depuis une carte du fil. */
export function ActionBar({ vote, thread, share, save, more }: ActionBarProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = Boolean(more && (more.report || more.onEdit || more.onDelete));

  return (
    <View style={styles.bar}>
      {vote ? <ScoreCapsule score={vote.score} value={vote.value} onVote={vote.onVote} /> : null}
      {thread ? (
        <Pressable
          onPress={() => setCommentsOpen(true)}
          accessibilityLabel={t('act.comment')}
          style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? colors.containerHigh : colors.container }]}
        >
          <MessageSquare size={16} color={colors.inkMuted} />
          <Text variant="smallStrong" tone="muted">
            {formatCount(thread.count)}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.spacer} />
      <Round label={t('feed.share')} onPress={() => shareContent(share.title, share.path)}>
        <Share2 size={17} color={colors.inkMuted} />
      </Round>
      {save ? <SaveButton type={save.type} id={save.id} title={share.title} /> : null}
      {hasMore ? (
        <Round label={t('act.more')} onPress={() => setMoreOpen(true)}>
          <MoreHorizontal size={18} color={colors.inkMuted} />
        </Round>
      ) : null}

      {thread ? <CommentsSheet kind={thread.kind} id={thread.id} visible={commentsOpen} onClose={() => setCommentsOpen(false)} /> : null}
      {hasMore && more ? <MoreSheet {...more} visible={moreOpen} onClose={() => setMoreOpen(false)} /> : null}
    </View>
  );
}

/** Toucher : « Enregistrer dans… » (choix des collections) ; appui long : enregistrement rapide. */
function SaveButton({ type, id, title }: { type: SaveType; id: string; title: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const requireAuth = useRequireAuth();
  const savedIn = useSavedIn(type, id);
  const saved = savedIn.length > 0;
  const toggle = useToggleSave();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Round
        label={t(saved ? 'act.saved' : 'feed.bookmark')}
        selected={saved}
        onPress={() =>
          requireAuth(() => {
            haptic.tap();
            setOpen(true);
          })
        }
        onLongPress={() =>
          requireAuth(() => {
            haptic.select();
            toggle.mutate(
              { type, id },
              {
                onSuccess: (added) => toast(t(added ? 'act.saved_toast' : 'act.unsaved_toast')),
                onError: (error) => toast(errorMessage(error), 'error'),
              },
            );
          })
        }
      >
        <Bookmark size={17} color={saved ? colors.primary : colors.inkMuted} fill={saved ? colors.primary : 'transparent'} />
      </Round>
      {open ? <SaveSheet target={{ type, id }} title={title} savedIn={savedIn} visible onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Round({
  label,
  selected,
  onPress,
  onLongPress,
  children,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={4}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.round, { backgroundColor: pressed ? colors.containerHigh : colors.container }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  spacer: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill },
  round: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
